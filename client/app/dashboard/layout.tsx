'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';
import DashboardSidebar from '@/components/dashboard-sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(true);
	const [user, setUser] = useState<any>(null);

	useEffect(() => {
		const checkUser = async () => {
			try {
				const res = await api.get('/users/me');
				const userData = res.data;

				// Check if user has completed onboarding (has organization)
				if (!userData.organization_id) {
					console.log('User has no organization, redirecting to /onboarding');
					router.push('/onboarding');
					return;
				}

				setUser(userData);
				setIsLoading(false);
			} catch (error: any) {
				console.error('Dashboard checkUser error:', error);
				if (error.response && error.response.status === 404) {
					console.log('User not found, redirecting to /onboarding');
					router.push('/onboarding');
				} else if (error.response && error.response.status === 401) {
					console.log('User not authenticated, redirecting to /login');
					router.push('/login');
				} else {
					// Handle other errors (e.g. 500)
					console.error('Unexpected error fetching user:', error.message);
					setIsLoading(false);
				}
			}
		};

		checkUser();
	}, [router]);

	if (isLoading) {
		return (
			<div className='flex h-screen w-full items-center justify-center bg-white dark:bg-slate-900'>
				<Loader2 className='h-8 w-8 animate-spin text-orange-500' />
			</div>
		);
	}

	return (
		<div className='flex h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 overflow-hidden transition-colors duration-300'>
			<DashboardSidebar user={user} />
			<main className='flex-1 overflow-y-auto bg-slate-50/50 dark:bg-transparent'>{children}</main>
		</div>
	);
}
