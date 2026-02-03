'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	LayoutDashboard,
	Settings,
	Bot,
	LogOut,
	User as UserIcon,
	Users,
	ChevronLeft,
	ChevronRight,
	Briefcase,
	ExternalLink,
} from 'lucide-react';
import { useState } from 'react';
import { signOut } from '@/app/login/actions';
import { ThemeToggle } from './theme-toggle';

interface DashboardSidebarProps {
	user: any;
}

export default function DashboardSidebar({ user }: DashboardSidebarProps) {
	const pathname = usePathname();
	const [isCollapsed, setIsCollapsed] = useState(false);

	const navigation = [
		{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
		{ name: 'Members', href: '/dashboard/members', icon: Users },
		{ name: 'Job Board', href: '/careers/evidenthire', icon: Briefcase, external: true },
	];

	const isActive = (href: string) => {
		if (href === '/dashboard' && pathname === '/dashboard') return true;
		if (href !== '/dashboard' && pathname.startsWith(href)) return true;
		if (href.includes('/settings') && pathname.includes('/settings')) return true;
		return false;
	};

	return (
		<aside
			className={`hidden flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 md:flex ${
				isCollapsed ? 'w-20' : 'w-64'
			}`}>
			<div className='flex h-16 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 relative'>
				<div
					className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${
						isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
					}`}>
					<div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20'>
						<Bot className='h-5 w-5 text-white' />
					</div>
					<span className='text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap'>
						EvidentHire
					</span>
				</div>
				{/* Fallback icon for collapsed header */}
				{isCollapsed && (
					<div className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20 mx-auto'>
						<Bot className='h-5 w-5 text-white' />
					</div>
				)}

				<button
					onClick={() => setIsCollapsed(!isCollapsed)}
					className='absolute -right-3 top-1/2 -translate-y-1/2 z-10 hidden md:flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm'>
					{isCollapsed ? <ChevronRight className='h-3 w-3' /> : <ChevronLeft className='h-3 w-3' />}
				</button>
			</div>

			<div className='flex flex-1 flex-col justify-between px-3 py-6'>
				<nav className='space-y-1.5'>
					{navigation.map((item) => {
						const active = isActive(item.href);
						const linkProps = item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
						return (
							<Link
								key={item.name}
								href={item.href}
								title={isCollapsed ? item.name : ''}
								{...linkProps}
								className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
									active
										? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20'
										: 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
								} ${isCollapsed ? 'justify-center' : ''}`}>
								<item.icon
									className={`shrink-0 h-5 w-5 ${
										active
											? 'text-white'
											: 'text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white'
									}`}
								/>
								{!isCollapsed && (
									<span className='truncate flex items-center gap-2'>
										{item.name}
										{item.external && <ExternalLink className='h-3 w-3 opacity-50' />}
									</span>
								)}
							</Link>
						);
					})}
				</nav>

				<div
					className={`mt-auto p-2 border-t border-slate-200 dark:border-slate-800 ${
						isCollapsed ? 'flex justify-center' : 'flex items-center justify-between'
					}`}>
					{!isCollapsed && (
						<span className='text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider ml-2'>
							Theme
						</span>
					)}
					<ThemeToggle />
				</div>

				<div className='border-t border-slate-200 dark:border-slate-800 pt-4 px-1'>
					<Link
						href='/dashboard/settings/profile'
						title={isCollapsed ? 'Settings' : ''}
						className={`group mb-4 flex items-center gap-3 rounded-lg px-2 py-2 transition-all hover:bg-slate-100 dark:hover:bg-slate-900 ${
							isCollapsed ? 'justify-center' : ''
						} ${
							pathname.includes('/settings')
								? 'bg-slate-100 dark:bg-slate-900/50 ring-1 ring-slate-200 dark:ring-slate-800'
								: ''
						}`}>
						<div
							className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 group-hover:border-orange-500/50 group-hover:text-orange-500 transition-colors ${
								pathname.includes('/settings') ? 'border-orange-500 text-orange-500' : ''
							}`}>
							{user?.email?.charAt(0).toUpperCase() || <UserIcon className='h-4 w-4' />}
						</div>
						{!isCollapsed && (
							<div className='overflow-hidden transition-all duration-300'>
								<p className='truncate text-sm font-medium text-slate-900 dark:text-white group-hover:text-orange-400'>
									{user?.full_name || user?.email}
								</p>
								<p className='truncate text-xs text-slate-500 capitalize'>{user?.role || 'User'}</p>
							</div>
						)}
					</Link>

					<form action={signOut}>
						<button
							title={isCollapsed ? 'Sign Out' : ''}
							className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-500 transition-colors ${
								isCollapsed ? 'justify-center' : ''
							}`}>
							<LogOut className='shrink-0 h-4 w-4' />
							{!isCollapsed && <span>Sign Out</span>}
						</button>
					</form>
				</div>
			</div>
		</aside>
	);
}
