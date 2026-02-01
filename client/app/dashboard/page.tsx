import { createClient } from '@/utils/supabase/server';
import { LayoutDashboard, Settings, User } from 'lucide-react';
import PositionManagement from '@/components/position-management';
import InterviewList from '@/components/interview-list';

export default async function Dashboard() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	return (
		<div className='mx-auto max-w-7xl py-10 px-4 sm:px-6 lg:px-8'>
			<header className='mb-8'>
				<h1 className='text-3xl font-bold text-white'>Dashboard</h1>
				<p className='mt-1 text-sm text-slate-400'>Manage your interviews and candidate reports.</p>
			</header>

			<div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
				{/* Stat Card 1 */}
				<div className='rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-sm'>
					<div className='flex items-center justify-between'>
						<div>
							<p className='text-sm font-medium text-slate-400'>Total Interviews</p>
							<p className='mt-1 text-2xl font-semibold text-white'>24</p>
						</div>
						<div className='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500'>
							<LayoutDashboard className='h-5 w-5' />
						</div>
					</div>
					<div className='mt-4 flex items-center text-sm text-green-500'>
						<span className='font-medium'>↑ 12%</span>
						<span className='ml-2 text-slate-400'>from last month</span>
					</div>
				</div>

				{/* Stat Card 2 */}
				<div className='rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-sm'>
					<div className='flex items-center justify-between'>
						<div>
							<p className='text-sm font-medium text-slate-400'>Pending Reviews</p>
							<p className='mt-1 text-2xl font-semibold text-white'>3</p>
						</div>
						<div className='flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500'>
							<User className='h-5 w-5' />
						</div>
					</div>
					<div className='mt-4 flex items-center text-sm text-slate-400'>
						<span className='font-medium text-slate-300'>2 Urgent</span>
						<span className='ml-2'>require attention</span>
					</div>
				</div>

				{/* Stat Card 3 */}
				<div className='rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-sm'>
					<div className='flex items-center justify-between'>
						<div>
							<p className='text-sm font-medium text-slate-400'>Team Usage</p>
							<p className='mt-1 text-2xl font-semibold text-white'>92%</p>
						</div>
						<div className='flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-500'>
							<Settings className='h-5 w-5' />
						</div>
					</div>
					<div className='mt-4 flex items-center text-sm text-green-500'>
						<span className='font-medium'>All systems operational</span>
					</div>
				</div>
			</div>

			{/* Interview List Section */}
			<InterviewList />

			{/* Position Management Section */}
			<PositionManagement />
		</div>
	);
}
