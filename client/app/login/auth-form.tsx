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
			} else if (event === 'PASSWORD_RECOVERY') {
				router.push('/dashboard/settings/security');
			}
		});

		return () => subscription.unsubscribe();
	}, [router, supabase]);

	return (
		<Auth
			supabaseClient={supabase}
			view='sign_in'
			appearance={{
				theme: ThemeSupa,
				variables: {
					default: {
						colors: {
							brand: '#ea580c',
							brandAccent: '#f97316',
							brandButtonText: 'white',
							defaultButtonBackground: '#334155',
							defaultButtonBackgroundHover: '#475569',
							defaultButtonBorder: '#475569',
							defaultButtonText: 'white',
							dividerBackground: '#475569',
							inputBackground: '#1e293b',
							inputBorder: '#475569',
							inputBorderHover: '#64748b',
							inputBorderFocus: '#f97316',
							inputText: 'white',
							inputLabelText: '#94a3b8',
							inputPlaceholder: '#64748b',
							messageText: '#94a3b8',
							messageTextDanger: '#f87171',
							anchorTextColor: '#fb923c',
							anchorTextHoverColor: '#fdba74',
						},
						space: {
							spaceSmall: '4px',
							spaceMedium: '8px',
							spaceLarge: '16px',
							labelBottomMargin: '8px',
							anchorBottomMargin: '4px',
							emailInputSpacing: '4px',
							socialAuthSpacing: '8px',
							buttonPadding: '12px 16px',
							inputPadding: '12px 16px',
						},
						fontSizes: {
							baseBodySize: '14px',
							baseInputSize: '14px',
							baseLabelSize: '14px',
							baseButtonSize: '14px',
						},
						fonts: {
							bodyFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
							buttonFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
							inputFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
							labelFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
						},
						borderWidths: {
							buttonBorderWidth: '1px',
							inputBorderWidth: '1px',
						},
						radii: {
							borderRadiusButton: '9999px',
							buttonBorderRadius: '9999px',
							inputBorderRadius: '12px',
						},
					},
				},
				style: {
					button: {
						fontWeight: '600',
						transition: 'all 0.2s ease',
					},
					anchor: {
						fontWeight: '500',
					},
					container: {
						gap: '16px',
					},
					label: {
						fontWeight: '500',
					},
					input: {
						transition: 'all 0.2s ease',
					},
					message: {
						borderRadius: '8px',
						padding: '12px',
					},
				},
			}}
			theme='dark'
			showLinks={true}
			providers={[]}
			redirectTo={
				typeof window !== 'undefined'
					? `${window.location.origin}/auth/callback?next=/dashboard/settings/security`
					: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard/settings/security`
			}
		/>
	);
}
