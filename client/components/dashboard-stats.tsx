'use client';

import { useState, useEffect } from 'react';
import { LayoutDashboard, User, Briefcase, Loader2, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

export default function DashboardStats() {
	const [stats, setStats] = useState({
		open_positions: 0,
		total_interviews: 0,
		pending_reviews: 0,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		async function fetchStats() {
			try {
				const res = await api.get('/positions/dashboard/stats');
				setStats(res.data);
				setError(false);
			} catch (err) {
				console.error('Error fetching dashboard stats:', err);
				setError(true);
			} finally {
				setIsLoading(false);
			}
		}
		fetchStats();
	}, []);

	if (isLoading) {
		return (
			<div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
				{[1, 2, 3].map((i) => (
					<div
						key={i}
						className='h-32 animate-pulse rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50'
					/>
				))}
			</div>
		);
	}

	if (error) {
		return (
			<div className='rounded-xl border border-red-500/20 bg-red-500/5 p-6 flex items-center gap-3 text-red-500'>
				<AlertCircle className='h-5 w-5' />
				<span className='text-sm font-medium'>Failed to load dashboard metrics.</span>
			</div>
		);
	}

	return (
		<div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
			{/* Stat Card 1: Total Interviews */}
			<div className='group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750'>
				<div className='flex items-center justify-between'>
					<div>
						<p className='text-sm font-medium text-slate-500 dark:text-slate-400'>Total Interviews</p>
						<p className='mt-1 text-2xl font-semibold text-slate-900 dark:text-white'>{stats.total_interviews}</p>
					</div>
					<div className='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 transition-transform group-hover:scale-110'>
						<LayoutDashboard className='h-5 w-5' />
					</div>
				</div>
				<div className='mt-4 flex items-center text-sm text-slate-400 dark:text-slate-500'>
					<span>Lifetime interviews conducted</span>
				</div>
			</div>

			{/* Stat Card 2: Pending Reviews */}
			<div className='group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750'>
				<div className='flex items-center justify-between'>
					<div>
						<p className='text-sm font-medium text-slate-500 dark:text-slate-400'>Pending Reviews</p>
						<p className='mt-1 text-2xl font-semibold text-slate-900 dark:text-white'>{stats.pending_reviews}</p>
					</div>
					<div className='flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20 transition-transform group-hover:scale-110'>
						<User className='h-5 w-5' />
					</div>
				</div>
				<div className='mt-4 flex items-center text-sm text-orange-600 dark:text-orange-500/80'>
					<span className='font-medium'>Require your attention</span>
				</div>
			</div>

			{/* Stat Card 3: Open Positions */}
			<div className='group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750'>
				<div className='flex items-center justify-between'>
					<div>
						<p className='text-sm font-medium text-slate-500 dark:text-slate-400'>Open Positions</p>
						<p className='mt-1 text-2xl font-semibold text-slate-900 dark:text-white'>{stats.open_positions}</p>
					</div>
					<div className='flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 transition-transform group-hover:scale-110'>
						<Briefcase className='h-5 w-5' />
					</div>
				</div>
				<div className='mt-4 flex items-center text-sm text-green-600 dark:text-green-500/80'>
					<span className='font-medium'>Active job positions</span>
				</div>
			</div>
		</div>
	);
}
