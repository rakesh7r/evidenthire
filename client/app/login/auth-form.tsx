'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/utils/supabase/client';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

export default function AuthForm() {
	const supabase = createClient();
	const router = useRouter();

	useEffect(() => {
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
			if (event === 'SIGNED_IN') {
				console.log('Signed In User:', session?.user);
				router.push('/');
				router.refresh();
			}
		});

		return () => subscription.unsubscribe();
	}, [router, supabase]);

	return (
		<Auth
			supabaseClient={supabase}
			view='sign_in'
			appearance={{ theme: ThemeSupa }}
			theme='light'
			showLinks={true}
			providers={[]}
			redirectTo={`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`}
		/>
	);
}
