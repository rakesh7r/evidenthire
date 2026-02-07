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
}> => {
	const systemPrompt = `You are an expert ATS (Applicant Tracking System) and technical recruiter. Your task is to analyze a candidate's resume against a specific job description.
    
    Provide a structured JSON output with the following fields:
    - overallScore: A number between 0 and 100 representing the overall match.
    - summary: A brief summary of the candidate's suitability.
    - strengths: A list of key strengths relevant to the role.
    - weaknesses: A list of potential gaps or missing requirements.
    - skillsMatch: An array of objects showing which required skills from the JD are present in the resume. Format: { skill: "skill name", match: true/false }.
    
    Be objective and strict but fair. Focus on technical skills, experience, and relevant keywords.`;

	const userMessage = `
    Job Description:
    ${jobDescription}
    
    Candidate Resume Text:
    ${resumeText}
    
    Please analyze this resume against the job description and return the JSON analysis.`;

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
		return JSON.parse(content);
	} catch (error) {
		console.error('Error analyzing resume:', error);
		throw new Error('Failed to analyze resume via AI');
	}
};
