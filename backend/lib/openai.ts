import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY || 'dummy-key-to-prevent-crash';

if (!process.env.OPENAI_API_KEY) {
	console.warn('WARNING: OPENAI_API_KEY is not defined. AI features will not work.');
}

const openai = new OpenAI({
	apiKey: apiKey,
});

export default openai;
