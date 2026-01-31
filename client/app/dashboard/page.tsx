import { createClient } from '@/utils/supabase/server';
import { signOut } from '../login/actions';
import { Bell, Bot, FileText, LayoutDashboard, Settings, User } from 'lucide-react';
import TeamManagement from '@/components/team-management';
import PositionManagement from '@/components/position-management';

export default async function Dashboard() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	return (
		<div className='min-h-screen bg-slate-900 font-sans text-slate-50'>
			{/* Top Navigation */}
			<nav className='sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-900 shadow-sm'>
				<div className='mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8'>
					<div className='flex items-center gap-2'>
						<div className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20'>
							<Bot className='h-5 w-5 text-white' />
						</div>
						<span className='text-xl font-bold tracking-tight text-white'>EvidentHire</span>
					</div>

					<div className='flex items-center gap-4'>
						<button className='relative rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors'>
							<Bell className='h-5 w-5' />
							<span className='absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-slate-900'></span>
						</button>
						<div className='h-6 w-px bg-slate-800'></div>
						<div className='flex items-center gap-3'>
							<div className='h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-semibold text-sm border border-orange-500/20'>
								{user?.email?.charAt(0).toUpperCase()}
							</div>
							<div className='hidden md:block text-sm'>
								<p className='font-medium text-slate-200'>{user?.email}</p>
								<p className='text-xs text-slate-500'>Interviewer</p>
							</div>
							<form action={signOut}>
								<button className='ml-2 text-sm text-slate-400 hover:text-white transition-colors'>Sign Out</button>
							</form>
						</div>
					</div>
				</div>
			</nav>

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

				{/* Recent Activity / Empty State */}
				<div className='mt-8 rounded-xl border border-slate-700 bg-slate-800 shadow-sm'>
					<div className='border-b border-slate-700 px-6 py-4'>
						<h3 className='text-base font-semibold leading-6 text-white'>Recent Interviews</h3>
					</div>
					<div className='p-6 text-center'>
						<div className='mx-auto h-24 w-24 rounded-full bg-slate-700/50 flex items-center justify-center mb-4'>
							<FileText className='h-10 w-10 text-slate-500' />
						</div>
						<h3 className='mt-2 text-sm font-medium text-white'>No interviews yet</h3>
						<p className='mt-1 text-sm text-slate-400'>Get started by creating a new interview pipeline.</p>
						<div className='mt-6'>
							<button className='inline-flex items-center rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600'>
								<User
									className='-ml-0.5 mr-1.5 h-5 w-5'
									aria-hidden='true'
								/>
								New Interview
							</button>
						</div>
					</div>
				</div>

				{/* Position Management Section */}
				<PositionManagement />

				{/* Team Management Section */}
				<TeamManagement />
			</div>
		</div>
	);
}
