import PositionManagement from '@/components/position-management';
import InterviewList from '@/components/interview-list';
import DashboardStats from '@/components/dashboard-stats';

export default async function Dashboard() {
	return (
		<div className='mx-auto max-w-7xl py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-300'>
			<header className='mb-8'>
				<h1 className='text-3xl font-bold text-slate-900 dark:text-white'>Dashboard</h1>
				<p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>Manage your interviews and candidate reports.</p>
			</header>

			{/* Aggregated Stats Section */}
			<DashboardStats />

			{/* Interview List Section */}
			<InterviewList />

			{/* Position Management Section */}
			<PositionManagement />
		</div>
	);
}
