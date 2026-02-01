'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Shield, Bell, ArrowLeft } from 'lucide-react';

const sidebarItems = [
	{
		title: 'Profile',
		href: '/dashboard/settings/profile',
		icon: User,
	},
	{
		title: 'Security',
		href: '/dashboard/settings/security',
		icon: Shield,
	},
	// {
	// 	title: 'Notifications',
	// 	href: '/dashboard/settings/notifications',
	// 	icon: Bell,
	// },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();

	return (
		<div className='flex flex-col lg:flex-row gap-8 py-10'>
			{/* Sidebar */}
			<aside className='w-full lg:w-64 flex-shrink-0'>
				<nav className='space-y-1'>
					{sidebarItems.map((item) => {
						const isActive = pathname === item.href;
						const Icon = item.icon;
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all ${
									isActive
										? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20'
										: 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
								}`}>
								<Icon
									className={`flex-shrink-0 -ml-1 mr-3 h-5 w-5 ${
										isActive
											? 'text-white'
											: 'text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white'
									}`}
								/>
								<span className='truncate'>{item.title}</span>
							</Link>
						);
					})}
				</nav>
			</aside>

			{/* Content Area */}
			<div className='flex-1 min-w-0'>
				<div className='bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden min-h-[500px] transition-colors duration-300'>
					{children}
				</div>
			</div>
		</div>
	);
}
