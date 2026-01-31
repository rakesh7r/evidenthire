export const getAppMode = () => {
	const mode = process.env.NEXT_PUBLIC_APP_MODE || 'development';
	const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;

	// If explicitly set, use that
	if (process.env.NEXT_PUBLIC_APP_MODE) {
		return process.env.NEXT_PUBLIC_APP_MODE;
	}

	// Infer from Vercel Env
	if (vercelEnv === 'production' || vercelEnv === 'preview') {
		return 'production';
	}

	return 'development';
};

export const isWaitlistMode = () => {
	return getAppMode() === 'development';
};
