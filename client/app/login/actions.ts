'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { headers } from 'next/headers';

export async function login(formData: FormData) {
	const supabase = await createClient();

	// validate fields
	const email = formData.get('email') as string;
	const password = formData.get('password') as string;

	if (!email || !password) {
		redirect('/login?error=Email and password are required');
	}

	const { error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		redirect(`/login?error=${encodeURIComponent(error.message)}`);
	}

	revalidatePath('/', 'layout');
	redirect('/');
}

export async function signup(formData: FormData) {
	const supabase = await createClient();
	const origin = (await headers()).get('origin');

	const email = formData.get('email') as string;
	const password = formData.get('password') as string;

	if (!email || !password) {
		redirect('/login?error=Email and password are required');
	}

	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
		},
	});

	if (error) {
		redirect(`/login?error=${encodeURIComponent(error.message)}`);
	}

	if (data.session) {
		revalidatePath('/', 'layout');
		redirect('/onboarding');
	}

	redirect('/login?message=Check your email to verify your account.');
}

export async function signOut() {
	const supabase = await createClient();
	await supabase.auth.signOut();
	revalidatePath('/', 'layout');
	redirect('/login');
}
