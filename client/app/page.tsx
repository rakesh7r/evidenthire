import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import LandingPageClient from '@/components/landing-page-client';
import { isWaitlistMode } from '@/utils/flags';

export default async function Home({
	searchParams,
}: {
	searchParams: { [key: string]: string | string[] | undefined };
}) {
	const code = searchParams?.code;

	if (code) {
		// Pass code to client for handling (allows detecting recovery flow)
		const supabase = await createClient();
		// We do NOT redirect here. We let the client handle the code exchange.
		// We still fetch user just in case needed for UI, but likely null if code not exchanged.
		const {
			data: { user },
		} = await supabase.auth.getUser();

		return (
			<LandingPageClient
				user={user}
				isWaitlist={false} // Assume false or check flag. Code implies auth flow.
				code={typeof code === 'string' ? code : undefined}
			/>
		);
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (isWaitlistMode()) {
		return (
			<LandingPageClient
				user={user}
				isWaitlist={true}
			/>
		);
	}

	if (user) {
		redirect('/dashboard');
	}

	return (
		<LandingPageClient
			user={user}
			isWaitlist={false}
		/>
	);
}
