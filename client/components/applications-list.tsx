'use client';

import { useEffect, useState } from 'react';
import {
	FileText,
	Calendar,
	Brain,
	ChevronRight,
	CheckCircle,
	Loader2,
	AlertCircle,
	ExternalLink,
	Trash2,
} from 'lucide-react';
import api from '@/lib/api';

interface CVAnalysis {
	overallScore?: number;
	summary?: string;
	skillsMatch?: { skill: string; match: boolean }[];
	experienceMatch?: string;
	recommendations?: string[];
}

interface Application {
	id: string;
	name: string;
	email: string;
	resume_s3_url: string | null;
	cv_analysis: CVAnalysis | null;
	status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected';
	created_at: string;
	updated_at: string;
}

function formatTimeAgo(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMins < 60) {
		return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
	} else if (diffHours < 24) {
		return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
	} else if (diffDays < 7) {
		return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
	} else {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
}

interface ApplicationsListProps {
	positionId: string;
	onSchedule: (app: Application) => void;
	onTotalChange?: (total: number) => void;
}

export default function ApplicationsList({ positionId, onSchedule, onTotalChange }: ApplicationsListProps) {
	const [applications, setApplications] = useState<Application[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		if (!positionId) return;

		const fetchApplications = async () => {
			try {
				setLoading(true);
				const { data } = await api.get(`/applications/position/${positionId}`);
				setApplications(data.applications || []);
				onTotalChange?.(data.total || 0);
			} catch (err: any) {
				console.error('Failed to fetch applications:', err);
				setError(err.response?.data?.error || 'Failed to fetch applications');
			} finally {
				setLoading(false);
			}
		};

		fetchApplications();
	}, [positionId, onTotalChange]);

	if (loading) {
		return (
			<div className='flex items-center justify-center py-12'>
				<div className='flex flex-col items-center gap-3'>
					<Loader2 className='h-8 w-8 animate-spin text-orange-500' />
					<p className='text-sm text-slate-500'>Loading applications...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className='flex flex-col items-center justify-center py-12 text-center'>
				<div className='rounded-full bg-red-100 dark:bg-red-900/20 p-3 mb-3'>
					<AlertCircle className='h-6 w-6 text-red-600 dark:text-red-400' />
				</div>
				<p className='text-sm text-slate-600 dark:text-slate-400'>{error}</p>
			</div>
		);
	}

	if (applications.length === 0) {
		return (
			<div className='flex flex-col items-center justify-center py-12 text-center'>
				<div className='rounded-full bg-slate-100 dark:bg-slate-800 p-4 mb-4'>
					<FileText className='h-8 w-8 text-slate-400' />
				</div>
				<h3 className='text-lg font-semibold text-slate-900 dark:text-white mb-1'>No Applications Yet</h3>
				<p className='text-sm text-slate-500 dark:text-slate-400 max-w-sm'>
					Applications will appear here once candidates apply through the careers page.
				</p>
			</div>
		);
	}

	return (
		<div className='space-y-4'>
			{applications.map((app) => {
				const atsScore = app.cv_analysis?.overallScore ?? 0;
				const aiSummary = app.cv_analysis?.summary || 'No AI analysis available';

				return (
					<div
						key={app.id}
						className='group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5 transition-all hover:border-orange-500/30 hover:shadow-lg dark:hover:shadow-orange-500/5'>
						<div className='flex items-start justify-between'>
							<div>
								<h3 className='font-semibold text-slate-900 dark:text-white text-lg'>{app.name}</h3>
								<p className='text-sm text-slate-500 dark:text-slate-400'>{app.email}</p>
								<p className='text-xs text-slate-400 mt-1 flex items-center gap-1'>
									<Calendar className='h-3 w-3' /> Applied {formatTimeAgo(app.created_at)}
								</p>
							</div>

							<div className='flex items-center gap-2'>
								{atsScore > 0 && (
									<div
										className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
											atsScore >= 90
												? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
												: atsScore >= 70
												? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
												: 'bg-red-500/10 text-red-600 dark:text-red-400'
										}`}>
										<Brain className='h-4 w-4' />
										{atsScore}% Match
									</div>
								)}
							</div>
						</div>

						{/* AI Summary Section */}
						<div className='rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-100 dark:border-slate-800/50'>
							<p className='text-sm text-slate-600 dark:text-slate-300 leading-relaxed'>
								<span className='font-semibold text-orange-500 mr-2'>AI Summary:</span>
								{aiSummary}
							</p>
						</div>

						<div className='flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800'>
							<div className='flex items-center gap-3'>
								{app.resume_s3_url ? (
									<a
										href={app.resume_s3_url}
										target='_blank'
										rel='noopener noreferrer'
										className='text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 flex items-center gap-1.5 transition-colors'>
										<FileText className='h-4 w-4' />
										View Resume
										<ExternalLink className='h-3 w-3' />
									</a>
								) : (
									<span className='text-sm text-slate-400 flex items-center gap-1.5'>
										<FileText className='h-4 w-4' />
										No resume
									</span>
								)}
							</div>

							{app.status === 'shortlisted' ? (
								<div className='flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg'>
									<CheckCircle className='h-4 w-4' />
									Shortlisted
								</div>
							) : (
								<div className='flex items-center gap-2'>
									<button
										onClick={async () => {
											if (
												confirm(
													'Are you sure you want to reject this application? This will remove the resume and analysis.'
												)
											) {
												try {
													await api.put(`/applications/${app.id}/status`, { status: 'rejected' });
													setApplications((prev) => prev.filter((a) => a.id !== app.id));
													onTotalChange?.(applications.length - 1);
												} catch (err) {
													console.error('Failed to reject application:', err);
													alert('Failed to reject application');
												}
											}
										}}
										className='flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900/30 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all active:scale-95'>
										<Trash2 className='h-4 w-4' />
										Reject
									</button>
									<button
										onClick={() => onSchedule(app)}
										className='flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-500 transition-all active:scale-95'>
										Schedule Interview
										<ChevronRight className='h-4 w-4' />
									</button>
								</div>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
