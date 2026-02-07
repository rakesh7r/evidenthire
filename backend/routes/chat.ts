import { Hono } from 'hono';
import { sql } from '../db';
import { authMiddleware, type AuthEnv } from '../middleware/auth';
import { searchResumes } from '../services/qdrant.service';
import openai from '../lib/openai';

const app = new Hono<AuthEnv>();

// All routes require authentication
app.use('/*', authMiddleware);

interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

interface CandidateRecommendation {
	applicationId: string;
	name: string;
	email: string;
	overallScore: number | null;
	matchedSkills: string[];
	unmatchedSkills: string[];
	bonusSkills: string[];
	similarityScore: number;
	resumePreview: string;
}

/**
 * POST /chat
 * RAG-powered chat for resume search and analysis
 */
app.post('/', async (c) => {
	const user = c.get('user');

	try {
		const body = await c.req.json();
		const { message, positionId, conversationHistory = [] } = body;

		if (!message) {
			return c.json({ error: 'Message is required' }, 400);
		}

		// Get user's organization
		const userOrg = await sql`
            SELECT organization_id FROM user_account WHERE id = ${user.id}
        `;

		if (!userOrg || userOrg.length === 0) {
			return c.json({ error: 'User organization not found' }, 403);
		}

		const orgId = userOrg[0]!.organization_id;

		// If positionId provided, get position details for context
		let positionContext = '';
		let positionTitle = '';
		if (positionId) {
			const positions = await sql`
                SELECT id, title, job_description, requirements
                FROM position
                WHERE id = ${positionId} AND organization_id = ${orgId}
            `;

			if (positions && positions.length > 0) {
				const pos = positions[0]!;
				positionTitle = pos.title;
				positionContext = `
Current Position Context:
- Title: ${pos.title}
- Job Description: ${pos.job_description || 'Not available'}
`;
			}
		}

		// Perform semantic search to find relevant candidates
		const searchResults = await searchResumes(message, orgId, {
			positionId: positionId || undefined,
			excludeStatus: 'rejected',
			limit: 10,
		});

		// Build candidate context for the LLM
		let candidateContext = '';
		const recommendations: CandidateRecommendation[] = [];

		if (searchResults.length > 0) {
			candidateContext = '\n\nRelevant Candidates Found:\n';

			for (const result of searchResults) {
				const candidateInfo = `
---
Candidate: ${result.candidateName}
Email: ${result.candidateEmail}
ATS Score: ${result.overallScore ?? 'N/A'}/100
Experience Score: ${result.experienceScore ?? 'N/A'}/100
Projects Score: ${result.projectsScore ?? 'N/A'}/100
Matched Skills: ${result.matchedSkills.length > 0 ? result.matchedSkills.join(', ') : 'None specified'}
Missing Skills: ${result.unmatchedSkills.length > 0 ? result.unmatchedSkills.join(', ') : 'None'}
Bonus Skills: ${result.bonusSkills.length > 0 ? result.bonusSkills.join(', ') : 'None'}
Resume Preview: ${result.resumePreview}
Semantic Match Score: ${(result.score * 100).toFixed(1)}%
`;
				candidateContext += candidateInfo;

				recommendations.push({
					applicationId: result.applicationId,
					name: result.candidateName,
					email: result.candidateEmail,
					overallScore: result.overallScore,
					matchedSkills: result.matchedSkills,
					unmatchedSkills: result.unmatchedSkills,
					bonusSkills: result.bonusSkills,
					similarityScore: result.score,
					resumePreview: result.resumePreview,
				});
			}
		} else {
			candidateContext = '\n\nNo relevant candidates found in the database for this query.';
		}

		// Build the system prompt
		const systemPrompt = `You are an AI recruiting assistant for EvidentHire. Your role is to help recruiters find and analyze candidates based on their resumes and job requirements.

You have access to candidate data retrieved from the resume database using semantic search. Use this information to:
1. Answer questions about candidates
2. Recommend the best matches for specific requirements
3. Compare candidates
4. Highlight strengths and potential concerns
5. Suggest interview questions based on candidate profiles

Be helpful, concise, and data-driven in your responses. When recommending candidates, explain your reasoning clearly.

${positionContext}
${candidateContext}

IMPORTANT:
- Only reference candidates from the provided data
- If asked about candidates not in the data, explain that you can only see candidates matching the search
- Provide specific details (scores, skills) when discussing candidates
- If no candidates match, suggest the recruiter refine their search or check if applications exist`;

		// Build conversation messages
		const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
			{ role: 'system', content: systemPrompt },
		];

		// Add conversation history (last 10 messages max)
		const recentHistory = conversationHistory.slice(-10) as ChatMessage[];
		for (const msg of recentHistory) {
			messages.push({ role: msg.role, content: msg.content });
		}

		// Add current user message
		messages.push({ role: 'user', content: message });

		// Generate AI response
		const response = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages,
			temperature: 0.7,
			max_tokens: 1000,
		});

		const assistantMessage = response.choices[0]?.message?.content || 'I apologize, I could not generate a response.';

		return c.json({
			message: assistantMessage,
			recommendations: recommendations.slice(0, 5), // Top 5 recommendations
			totalCandidatesFound: searchResults.length,
			positionTitle: positionTitle || null,
		});
	} catch (error: any) {
		console.error('Error in chat:', error);
		return c.json({ error: error.message || 'Internal Server Error' }, 500);
	}
});

/**
 * POST /chat/quick-actions
 * Predefined quick actions for common recruiting tasks
 */
app.post('/quick-actions', async (c) => {
	const user = c.get('user');

	try {
		const body = await c.req.json();
		const { action, positionId } = body;

		if (!positionId) {
			return c.json({ error: 'Position ID is required' }, 400);
		}

		// Get user's organization
		const userOrg = await sql`
            SELECT organization_id FROM user_account WHERE id = ${user.id}
        `;

		if (!userOrg || userOrg.length === 0) {
			return c.json({ error: 'User organization not found' }, 403);
		}

		const orgId = userOrg[0]!.organization_id;

		// Get position details
		const positions = await sql`
            SELECT id, title, job_description
            FROM position
            WHERE id = ${positionId} AND organization_id = ${orgId}
        `;

		if (!positions || positions.length === 0) {
			return c.json({ error: 'Position not found' }, 404);
		}

		const position = positions[0]!;
		let queryMessage = '';

		switch (action) {
			case 'top_candidates':
				queryMessage = `Find the top 5 best matching candidates for the ${position.title} position based on their skills, experience, and overall fit.`;
				break;
			case 'skill_gaps':
				queryMessage = `Analyze the candidate pool and identify common skill gaps. Which required skills are most candidates missing?`;
				break;
			case 'compare_top':
				queryMessage = `Compare the top 3 candidates for this position. What are their relative strengths and weaknesses?`;
				break;
			case 'interview_ready':
				queryMessage = `Which candidates have the highest scores and are ready for interview? List candidates with ATS score above 75.`;
				break;
			case 'hidden_gems':
				queryMessage = `Find candidates who might have lower ATS scores but bring unique bonus skills or interesting experience that could benefit the team.`;
				break;
			default:
				return c.json({ error: 'Invalid action' }, 400);
		}

		// Redirect to main chat endpoint logic
		const searchResults = await searchResumes(position.job_description || position.title, orgId, {
			positionId,
			excludeStatus: 'rejected',
			limit: 10,
		});

		// Build context
		let candidateContext = '';
		const recommendations: CandidateRecommendation[] = [];

		for (const result of searchResults) {
			candidateContext += `
Candidate: ${result.candidateName} (${result.candidateEmail})
- ATS Score: ${result.overallScore ?? 'N/A'}/100
- Matched Skills: ${result.matchedSkills.join(', ') || 'None'}
- Missing Skills: ${result.unmatchedSkills.join(', ') || 'None'}
- Bonus Skills: ${result.bonusSkills.join(', ') || 'None'}
- Resume: ${result.resumePreview}
---
`;
			recommendations.push({
				applicationId: result.applicationId,
				name: result.candidateName,
				email: result.candidateEmail,
				overallScore: result.overallScore,
				matchedSkills: result.matchedSkills,
				unmatchedSkills: result.unmatchedSkills,
				bonusSkills: result.bonusSkills,
				similarityScore: result.score,
				resumePreview: result.resumePreview,
			});
		}

		const systemPrompt = `You are an AI recruiting assistant. Analyze the candidate data and respond to the query.

Position: ${position.title}
Job Description: ${position.job_description || 'Not available'}

Candidates:
${candidateContext || 'No candidates found'}

Provide a clear, actionable response.`;

		const response = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: queryMessage },
			],
			temperature: 0.7,
			max_tokens: 1000,
		});

		return c.json({
			message: response.choices[0]?.message?.content || 'Could not generate response',
			recommendations: recommendations.slice(0, 5),
			action,
			query: queryMessage,
		});
	} catch (error: any) {
		console.error('Error in quick action:', error);
		return c.json({ error: error.message || 'Internal Server Error' }, 500);
	}
});

export default app;
