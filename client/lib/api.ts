import axios from 'axios';
import { createClient } from '@/utils/supabase/client';

const api = axios.create({
	baseURL: process.env.NEXT_PUBLIC_BACKEND_API_URL,
	headers: {
		'Content-Type': 'application/json',
	},
});

// Request interceptor to add auth token or other common headers if needed
api.interceptors.request.use(
	async (config) => {
		const supabase = createClient();
		const {
			data: { session },
		} = await supabase.auth.getSession();

		if (session?.access_token) {
			config.headers.Authorization = `Bearer ${session.access_token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

api.interceptors.response.use(
	(response) => response,
	(error) => {
		// Global error handling could go here (e.g. log out on 401)
		return Promise.reject(error);
	}
);

export function addHeaders(headers: Record<string, string>) {
	api.defaults.headers.common = { ...api.defaults.headers.common, ...headers };
}

export default api;
