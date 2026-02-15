import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
	console.warn('WARNING: OPENAI_API_KEY is not defined. AI features will not work.');
	throw new Error('OPENAI_API_KEY is not defined. AI features will not work.');
}

const openai = new OpenAI({
	apiKey: apiKey,
});

export default openai;
