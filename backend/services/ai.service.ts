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
