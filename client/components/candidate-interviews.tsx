'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
	ChevronDown,
	ChevronRight,
	FileText,
	Download,
	Eye,
	User,
	Calendar,
	Clock,
	CheckCircle2,
	AlertCircle,
	ExternalLink,
	Search,
	RefreshCw,
} from 'lucide-react';

interface InterviewRound {
	id: string;
	type: string;
	date: string;
	time: string;
	status: 'completed' | 'ongoing' | 'scheduled' | 'failed' | 'cancelled';
	interviewer: string;
	analysis: string;
	reportUrl?: string | null;
}

// ...

// In JSX, around line 239 (now shifted due to refactoring, likely around line 240 in previous context, but I need to find the button)
// I will target the button rendering block.

// The target content for replacement:
/*
													{interview.status === 'completed' && (
														<button className='flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-orange-500 shadow-lg shadow-orange-600/10'>
															<Eye className='h-3.5 w-3.5' />
															VIEW REPORT
														</button>
													)}
*/

// I will do two replacements. First imports and interface. Then button.
// WAIT, I can only do ONE replace per call if contigous? No, `multi_replace` is for non-contiguous.
// The tool `replace_file_content` is for single contiguous block.
// I'll use `multi_replace_file_content`.

interface CandidateGroup {
	id: string;
	name: string;
	email: string;
	overallStatus: string;
	interviews: InterviewRound[];
}

export default function CandidateInterviews({
	positionId,
	onReschedule,
}: {
	positionId: string;
	onReschedule?: (candidateName: string, candidateEmail: string, interviewType?: string) => void;
}) {
	// State
	const [candidates, setCandidates] = useState<CandidateGroup[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const fetchInterviews = useCallback(async () => {
		try {
			setLoading(true);
			const { data } = await api.get(`/interviews/position/${positionId}`);

			// Process and group interviews by candidate
			const groupedCandidates: Record<string, CandidateGroup> = {};

			data.forEach((interview: any) => {
				const candidateId = interview.candidate_id;

				if (!groupedCandidates[candidateId]) {
					groupedCandidates[candidateId] = {
						id: candidateId,
						name: interview.candidate_name,
						email: interview.candidate_email,
						overallStatus: 'Active', // Logic to determine overall status can be improved
						interviews: [],
					};
				}

				const dateObj = new Date(interview.scheduled_start);
				const formattedDate = dateObj.toLocaleDateString();
				const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

				// Determine interviewer name (first one or formatted list)
				const interviewerName =
					interview.interviewers && interview.interviewers.length > 0
						? interview.interviewers[0].full_name
						: 'Unassigned';

				groupedCandidates[candidateId].interviews.push({
					id: interview.id,
					type: interview.round_title || interview.round_type || 'Interview',
					date: formattedDate,
					time: formattedTime,
					status: interview.status,
					interviewer: interviewerName,
					analysis: interview.report_s3_url ? 'Report Available' : 'No analysis yet.',
					reportUrl: interview.report_s3_url,
				});
			});

			setCandidates(Object.values(groupedCandidates));
		} catch (err: any) {
			console.error('Failed to fetch interviews:', err);
			setError('Failed to load interviews');
		} finally {
			setLoading(false);
		}
	}, [positionId]);

	useEffect(() => {
		fetchInterviews();
	}, [fetchInterviews]);

	const [expandedCandidate, setExpandedCandidate] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState('');

	const filteredCandidates = candidates.filter(
		(candidate) =>
			candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			candidate.email.toLowerCase().includes(searchTerm.toLowerCase())
	);

	const toggleExpand = (id: string) => {
		setExpandedCandidate(expandedCandidate === id ? null : id);
	};

	return (
		<div className='space-y-6'>
			{/* Search Bar */}
			<div className='relative'>
				<Search className='absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-500' />
				<input
					type='text'
					placeholder='Search candidates by name or email...'
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className='w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-500 transition-all focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50'
				/>
			</div>

			<div className='space-y-4'>
				{filteredCandidates.map((candidate) => (
					<div
						key={candidate.id}
						className='overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 transition-all hover:bg-slate-100 dark:hover:bg-slate-900/60'>
						{/* Candidate Header */}
						<div
							className='flex cursor-pointer items-center justify-between p-5'
							onClick={() => toggleExpand(candidate.id)}>
							<div className='flex items-center gap-4'>
								<div className='flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 border border-orange-200 dark:border-orange-500/20'>
									<User className='h-6 w-6' />
								</div>
								<div>
									<h3 className='text-lg font-semibold text-slate-900 dark:text-white'>{candidate.name}</h3>
									<p className='text-sm text-slate-500 dark:text-slate-400'>{candidate.email}</p>
								</div>
							</div>

							<div className='flex items-center gap-6'>
								<div className='hidden md:block text-right'>
									<p className='text-xs uppercase tracking-wider text-slate-500 font-bold mb-1'>Status</p>
									<span className='inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20'>
										{candidate.overallStatus}
									</span>
								</div>
								<div className='hidden md:block text-right'>
									<p className='text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold mb-1'>
										Rounds
									</p>
									<p className='text-sm font-medium text-slate-900 dark:text-white'>{candidate.interviews.length}</p>
								</div>
								<div
									className='text-slate-500 transition-transform duration-200'
									style={{ transform: expandedCandidate === candidate.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>
									<ChevronDown className='h-5 w-5' />
								</div>
							</div>
						</div>

						{/* Expanded Interview List */}
						{expandedCandidate === candidate.id && (
							<div className='border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/30 p-5 space-y-4'>
								<h4 className='text-sm font-bold uppercase tracking-widest text-slate-500 mb-2'>Interview History</h4>
								<div className='space-y-4'>
									{candidate.interviews.map((interview) => (
										<div
											key={interview.id}
											className='rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-5'>
											<div className='flex flex-col md:flex-row md:items-start justify-between gap-4'>
												<div className='flex-1'>
													<div className='flex items-center gap-3 mb-2'>
														<h5 className='text-base font-semibold text-slate-900 dark:text-white'>{interview.type}</h5>
														<span
															className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border ${
																interview.status === 'completed'
																	? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
																	: interview.status === 'cancelled'
																	? 'bg-red-500/10 text-red-500 border-red-500/20'
																	: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
															}`}>
															{interview.status === 'completed' && <CheckCircle2 className='h-3 w-3' />}
															{interview.status === 'cancelled' && <AlertCircle className='h-3 w-3' />}
															{interview.status}
														</span>
													</div>

													<div className='grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-sm text-slate-500 dark:text-slate-400 mb-4'>
														<div className='flex items-center gap-2'>
															<Calendar className='h-4 w-4 text-orange-500' />
															<span>{interview.date}</span>
														</div>
														<div className='flex items-center gap-2'>
															<Clock className='h-4 w-4 text-orange-500' />
															<span>{interview.time}</span>
														</div>
														<div className='flex items-center gap-2'>
															<User className='h-4 w-4 text-orange-500' />
															<span>Interviewer: {interview.interviewer}</span>
														</div>
													</div>

													<div className='rounded-lg bg-white dark:bg-slate-950/50 p-4 border border-slate-200 dark:border-slate-800/50'>
														<p className='text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2'>
															AI Analysis Report
														</p>
														<p className='text-sm text-slate-700 dark:text-slate-300 italic'>"{interview.analysis}"</p>
													</div>
												</div>

												<div className='flex flex-col gap-2 shrink-0 md:min-w-[160px]'>
													{(interview.status === 'cancelled' || interview.status === 'failed') && (
														<button
															onClick={() => onReschedule?.(candidate.name, candidate.email, interview.type)}
															className='flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-orange-500 shadow-lg shadow-orange-600/10'>
															<RefreshCw className='h-3.5 w-3.5' />
															RESCHEDULE
														</button>
													)}
													{interview.status === 'completed' && (
														<button
															onClick={() => interview.reportUrl && window.open(interview.reportUrl, '_blank')}
															disabled={!interview.reportUrl}
															className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white transition-all shadow-lg ${
																interview.reportUrl
																	? 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/10 cursor-pointer'
																	: 'bg-slate-400 cursor-not-allowed opacity-70'
															}`}>
															<Eye className='h-3.5 w-3.5' />
															VIEW REPORT
														</button>
													)}
													<button className='flex items-center justify-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'>
														<Download className='h-3.5 w-3.5' />
														DOWNLOAD PDF
													</button>
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				))}
			</div>

			{filteredCandidates.length === 0 && (
				<div className='flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center'>
					<FileText className='h-12 w-12 text-slate-300 dark:text-slate-700 mb-4' />
					<h3 className='text-lg font-medium text-slate-500 dark:text-slate-400'>
						{searchTerm ? 'No matching candidates found' : 'No interviews recorded'}
					</h3>
					<p className='text-sm text-slate-400 dark:text-slate-500'>
						{searchTerm ? 'Try adjusting your search terms.' : 'Schedule an interview to see analysis reports.'}
					</p>
				</div>
			)}
		</div>
	);
}
