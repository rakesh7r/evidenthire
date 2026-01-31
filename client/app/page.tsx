import { createClient } from '@/utils/supabase/server';
import Dashboard from './dashboard/page';
import LandingPageClient from '@/components/landing-page-client';
import { isWaitlistMode } from '@/utils/flags';

export default async function Home() {
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
		return <Dashboard />;
	}

	return (
		<LandingPageClient
			user={user}
			isWaitlist={false}
		/>
	);
}
