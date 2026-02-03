'use client';

import { useState } from 'react';
import {
	FileText,
	Calendar,
	MoreHorizontal,
	CheckCircle,
	XCircle,
	AlertCircle,
	Brain,
	ChevronRight,
} from 'lucide-react';

interface Application {
	id: string;
	name: string;
	email: string;
	appliedDate: string;
	atsScore: number;
	aiSummary: string;
	status: 'new' | 'reviewed' | 'interview_scheduled' | 'rejected';
}

const MOCK_APPLICATIONS: Application[] = [
	{
		id: '1',
		name: 'Sarah Chen',
		email: 'sarah.chen@example.com',
		appliedDate: '2 hours ago',
		atsScore: 92,
		aiSummary:
			'Strong match for Senior Frontend role. 5 years of React experience, led team of 4. Previously at TechCorp.',
		status: 'new',
	},
	{
		id: '2',
		name: 'Michael Ross',
		email: 'm.ross@example.com',
		appliedDate: '5 hours ago',
		atsScore: 85,
		aiSummary: 'Good technical skills but lacks leadership experience required for "Senior" title. Strong portfolio.',
		status: 'reviewed',
	},
	{
		id: '3',
		name: 'Jessica Pearson',
		email: 'jessica.p@example.com',
		appliedDate: '1 day ago',
		atsScore: 95,
		aiSummary:
			'Exceptional candidate. Perfect skill match. Managed large scale distributed systems. Highly recommended.',
		status: 'interview_scheduled',
	},
	{
		id: '4',
		name: 'David Zane',
		email: 'd.zane@example.com',
		appliedDate: '2 days ago',
		atsScore: 65,
		aiSummary: 'Missing key requirements: TypeScript and Node.js experience is minimal.',
		status: 'rejected',
	},
];

export default function ApplicationsList({ onSchedule }: { onSchedule: (app: Application) => void }) {
	return (
		<div className='space-y-4'>
			{MOCK_APPLICATIONS.map((app) => (
				<div
					key={app.id}
					className='group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5 transition-all hover:border-orange-500/30 hover:shadow-lg dark:hover:shadow-orange-500/5'>
					<div className='flex items-start justify-between'>
						<div>
							<h3 className='font-semibold text-slate-900 dark:text-white text-lg'>{app.name}</h3>
							<p className='text-sm text-slate-500 dark:text-slate-400'>{app.email}</p>
							<p className='text-xs text-slate-400 mt-1 flex items-center gap-1'>
								<Calendar className='h-3 w-3' /> Applied {app.appliedDate}
							</p>
						</div>

						<div className='flex items-center gap-2'>
							<div
								className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
									app.atsScore >= 90
										? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
										: app.atsScore >= 70
										? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
										: 'bg-red-500/10 text-red-600 dark:text-red-400'
								}`}>
								<Brain className='h-4 w-4' />
								{app.atsScore}% Match
							</div>
						</div>
					</div>

					{/* AI Summary Section */}
					<div className='rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-100 dark:border-slate-800/50'>
						<p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
							<span className='font-semibold text-orange-500 mr-2'>AI Summary:</span>
							{app.aiSummary}
						</p>
					</div>

					<div className='flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800'>
						<div className='flex items-center gap-3'>
							<button className='text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors'>
								<FileText className='h-4 w-4' /> View Resume
							</button>
						</div>

						{app.status === 'interview_scheduled' ? (
							<div className='flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg'>
								<CheckCircle className='h-4 w-4' />
								Interview Scheduled
							</div>
						) : (
							<button
								onClick={() => onSchedule(app)}
								className='flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-500 transition-all active:scale-95'>
								Schedule Interview
								<ChevronRight className='h-4 w-4' />
							</button>
						)}
					</div>
				</div>
			))}
		</div>
	);
}
