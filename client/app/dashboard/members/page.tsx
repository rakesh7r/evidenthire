import { createClient } from '@/utils/supabase/server';
import TeamManagement from '@/components/team-management';

export default async function MembersPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	return (
		<div className='mx-auto max-w-7xl py-10 px-4 sm:px-6 lg:px-8'>
			<header className='mb-8'>
				<h1 className='text-3xl font-bold text-white'>Team Management</h1>
				<p className='mt-1 text-sm text-slate-400'>Manage your organization members and their roles.</p>
			</header>

			<TeamManagement currentUserId={user?.id || ''} />
		</div>
	);
}
