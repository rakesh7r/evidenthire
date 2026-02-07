import openai from '../lib/openai';
import type { RequirementsSchema } from '../../client/types/db';

interface GenerateJobDescriptionParams {
	title: string;
	requirements: RequirementsSchema;
	prompt?: string;
}

export const generateJobDescription = async (params: GenerateJobDescriptionParams): Promise<string> => {
	const { title, requirements, prompt } = params;

	const skillsList = requirements.skills.map((skill) => `${skill.name} (${skill.level})`).join(', ');
	// const weights = Object.entries(requirements.evaluation_weights)
	// 	.map(([key, value]) => `${key}: ${(value * 100).toFixed(0)}%`)
	// 	.join(', ');

	const systemPrompt = `You are an expert HR recruiter and technical hiring manager. Your task is to generate a comprehensive and professional job description based on the provided role details.
    
    The description should include:
    1. A compelling role summary
    2. Key responsibilities
    3. Required skills and qualifications (highlighting the specified skills)
    4. A section about the team/culture (generic but professional)
    
    Format the output in clear Markdown.`;

	const userMessage = `
    Job Title: ${title}
    
    Required Skills:
    ${skillsList || 'Not specified'}
    
    Additional Context/User Prompt:
    ${prompt || 'No additional context provided. Create a standard description for this role.'}
    
    Please generate a structured job description.`;

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userMessage },
			],
			temperature: 0.7,
		});

		return response.choices[0]?.message?.content || 'Failed to generate job description.';
	} catch (error) {
		console.error('Error generating job description:', error);
		throw new Error('Failed to generate job description via AI');
	}
};

export const analyzeResume = async (
	resumeText: string,
	jobDescription: string
): Promise<{
	overallScore: number;
	summary: string;
	strengths: string[];
	weaknesses: string[];
	skillsMatch: { skill: string; match: boolean }[];
	bonusSkills: string[];
	experienceScore: number;
	projectsScore: number;
}> => {
	const systemPrompt = `You are an expert ATS (Applicant Tracking System) and technical recruiter. Your task is to analyze a candidate's resume against a specific job description with PARTIAL SKILL MATCHING support.

IMPORTANT SKILL MATCHING RULES:
1. **Partial Matching**: If the job description requires a compound skill like "Data Structures and Algorithms", split it into individual skills and match each separately:
   - If resume has "Data Structures" → mark "Data Structures" as match: true
   - If resume lacks "Algorithms" → mark "Algorithms" as match: false
   
2. **Skill Variations**: Consider variations and synonyms as matches:
   - "React.js" = "React" = "ReactJS"
   - "Node.js" = "Node" = "NodeJS"
   - "AWS" = "Amazon Web Services"
   - "k8s" = "Kubernetes"
   - "ML" = "Machine Learning"

3. **skillsMatch array**: ONLY include skills that are REQUIRED in the job description. Split compound skills.

4. **bonusSkills array**: List additional relevant technical skills found in the resume that are NOT required in the job description but could be advantageous. These do NOT affect the score negatively or positively.

SCORING CRITERIA (overallScore 0-100):
- **Skills Match (40%)**: Percentage of required JD skills found in resume
- **Relevant Experience (35%)**: Years of experience, job titles, companies, relevant work history
- **Projects & Achievements (25%)**: Relevant projects, certifications, achievements mentioned

Provide these additional scores (0-100 each):
- experienceScore: How well does their experience match the role requirements?
- projectsScore: How relevant are their projects/achievements?

Provide a structured JSON output with:
- overallScore: Weighted score (0-100)
- summary: Brief summary of candidate suitability
- strengths: Key strengths relevant to the role
- weaknesses: Gaps or missing requirements (focus on JD requirements)
- skillsMatch: Array of { skill: "skill name", match: true/false } for EACH individual skill from JD
- bonusSkills: Array of additional skills from resume not in JD (as strings)
- experienceScore: Experience match score (0-100)
- projectsScore: Projects/achievements score (0-100)

Be objective, thorough, and fair.`;

	const userMessage = `
Job Description:
${jobDescription}

Candidate Resume Text:
${resumeText}

Analyze this resume against the job description. Remember to:
1. Split compound skills (e.g., "Data Structures and Algorithms" → separate entries)
2. Use partial matching for skills
3. List bonus skills separately (don't penalize for extra skills)
4. Focus scoring on JD requirements

Return the JSON analysis.`;

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userMessage },
			],
			temperature: 0.2,
			response_format: { type: 'json_object' },
		});

		const content = response.choices[0]?.message?.content || '{}';
		const parsed = JSON.parse(content);

		// Ensure all expected fields exist with defaults
		return {
			overallScore: parsed.overallScore ?? 0,
			summary: parsed.summary ?? '',
			strengths: parsed.strengths ?? [],
			weaknesses: parsed.weaknesses ?? [],
			skillsMatch: parsed.skillsMatch ?? [],
			bonusSkills: parsed.bonusSkills ?? [],
			experienceScore: parsed.experienceScore ?? 0,
			projectsScore: parsed.projectsScore ?? 0,
		};
	} catch (error) {
		console.error('Error analyzing resume:', error);
		throw new Error('Failed to analyze resume via AI');
	}
};
