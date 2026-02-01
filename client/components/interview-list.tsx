'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
	FileText,
	User,
	Plus,
	Calendar,
	Clock,
	Briefcase,
	Edit2,
	Send,
	Users,
	Loader2,
	AlertCircle,
	Trash2,
	Video,
} from 'lucide-react';
import CreateInterviewModal, { SimpleUser } from './create-interview-modal';
import { Position, UserRole } from '@/types/db';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Interview {
	id: string;
	candidate_name: string;
	candidate_email: string;
	position_id: string;
	position_title: string;
	scheduled_start: string;
	interviewer_ids: string[];
	status: string;
	candidate_access_key: string;
}

export default function InterviewList() {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [userRole, setUserRole] = useState<UserRole>('interviewer');
	const [positions, setPositions] = useState<Position[]>([]);
	const [availableUsers, setAvailableUsers] = useState<SimpleUser[]>([]);
	const [interviews, setInterviews] = useState<Interview[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Add state for editing
	const [editingInterview, setEditingInterview] = useState<Interview | null>(null);

	useEffect(() => {
		fetchData();
	}, []);

	const fetchData = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const [userRes, interviewsRes, positionsRes, teamRes] = await Promise.all([
				api.get('/users/me'),
				api.get('/interviews'),
				api.get('/positions'),
				api.get('/users/team'),
			]);

			setUserRole(userRes.data.role);
			setInterviews(interviewsRes.data);
			setPositions(positionsRes.data);
			setAvailableUsers(
				teamRes.data.map((u: any) => ({
					id: u.id,
					name: u.full_name || u.email,
					email: u.email,
				}))
			);
		} catch (err: any) {
			console.error('Failed to fetch interview data:', err);
			setError('Failed to load interviews. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleCreateInterview = async (data: any) => {
		const toastId = toast.loading(editingInterview ? 'Updating interview...' : 'Scheduling interview...');
		try {
			if (editingInterview) {
				const res = await api.put(`/interviews/${editingInterview.id}`, data);
				toast.success('Interview updated successfully', { id: toastId });
				// Refresh interviews
				const interviewsRes = await api.get('/interviews');
				setInterviews(interviewsRes.data);
			} else {
				const res = await api.post('/interviews', data);
				toast.success('Interview scheduled successfully', { id: toastId });
				setInterviews([res.data, ...interviews]);
			}
			setIsModalOpen(false);
			setEditingInterview(null);
		} catch (err: any) {
			console.error('Failed to save interview:', err);
			const errorMessage = err.response?.data?.error || 'Failed to save interview';
			toast.error(errorMessage, { id: toastId });
		}
	};

	const handleEditClick = (interview: Interview) => {
		setEditingInterview(interview);
		setIsModalOpen(true);
	};

	const handleResendEmail = async (id: string, email: string) => {
		const toastId = toast.loading('Resending invitation...');
		try {
			await api.post(`/interviews/${id}/invite`);
			toast.success(`Invitation email re-sent to ${email}`, { id: toastId });
		} catch (err: any) {
			console.error('Failed to resend email:', err);
			const errorMessage = err.response?.data?.error || 'Failed to resend email';
			toast.error(errorMessage, { id: toastId });
		}
	};

	const handleDeleteInterview = async (id: string) => {
		if (!confirm('Are you sure you want to delete this interview?')) return;

		const toastId = toast.loading('Deleting interview...');
		try {
			await api.delete(`/interviews/${id}`);
			toast.success('Interview deleted successfully', { id: toastId });
			setInterviews(interviews.filter((i) => i.id !== id));
		} catch (err: any) {
			console.error('Failed to delete interview:', err);
			const errorMessage = err.response?.data?.error || 'Failed to delete interview';
			toast.error(errorMessage, { id: toastId });
		}
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		setEditingInterview(null);
	};

	if (isLoading) {
		return (
			<div className='mt-8 flex h-64 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm'>
				<div className='flex flex-col items-center gap-2'>
					<Loader2 className='h-8 w-8 animate-spin text-orange-500' />
					<p className='text-sm text-slate-500 dark:text-slate-400'>Loading interviews...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className='mt-8 rounded-xl border border-red-500/20 bg-red-500/5 p-6 flex flex-col items-center gap-3 text-red-500'>
				<AlertCircle className='h-8 w-8' />
				<span className='text-sm font-medium'>{error}</span>
				<button
					onClick={fetchData}
					className='mt-2 text-xs font-semibold uppercase tracking-wider text-white bg-red-500/20 px-4 py-2 rounded hover:bg-red-500/30 transition-colors'>
					Retry
				</button>
			</div>
		);
	}

	return (
		<div className='mt-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden'>
			<div className='flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4'>
				<h3 className='text-base font-semibold leading-6 text-slate-900 dark:text-white'>Recent Interviews</h3>
				{['admin', 'recruiter'].includes(userRole) && (
					<button
						onClick={() => {
							setEditingInterview(null);
							setIsModalOpen(true);
						}}
						className='inline-flex items-center rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600'>
						<Plus className='-ml-0.5 mr-1.5 h-4 w-4' />
						New Interview
					</button>
				)}
			</div>

			<div className='p-6'>
				{interviews.length === 0 ? (
					<div className='text-center py-6'>
						<div className='mx-auto h-24 w-24 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mb-4'>
							<FileText className='h-10 w-10 text-slate-400 dark:text-slate-500' />
						</div>
						<h3 className='mt-2 text-sm font-medium text-slate-900 dark:text-white'>No interviews yet</h3>
						<p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>
							Get started by scheduling your first interview.
						</p>
					</div>
				) : (
					<div className='space-y-4'>
						{interviews.map((interview) => (
							<div
								key={interview.id}
								className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700/50'>
								<div className='flex items-start gap-4'>
									<div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20'>
										<User className='h-5 w-5' />
									</div>
									<div>
										<h4 className='font-medium text-slate-900 dark:text-white'>{interview.candidate_name}</h4>
										<p className='text-sm text-slate-500 dark:text-slate-400'>{interview.candidate_email}</p>
										<div className='mt-1 flex items-center gap-4 text-xs text-slate-500'>
											<span className='flex items-center gap-1.5'>
												<Briefcase className='h-3 w-3' />
												{interview.position_title}
											</span>
											{interview.interviewer_ids && interview.interviewer_ids.length > 0 && (
												<span className='flex items-center gap-1.5 text-slate-500 dark:text-slate-400'>
													<Users className='h-3 w-3' />
													{interview.interviewer_ids.length} Interviewer(s)
												</span>
											)}
										</div>
									</div>
								</div>

								<div className='flex flex-col items-end gap-3 sm:flex-row sm:items-center'>
									<div className='flex items-center gap-2 rounded-md bg-slate-100 dark:bg-slate-900 px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300'>
										<Calendar className='h-3.5 w-3.5 text-orange-500' />
										<span>{new Date(interview.scheduled_start).toLocaleDateString()}</span>
										<span className='w-px h-3 bg-slate-200 dark:bg-slate-700 mx-1'></span>
										<Clock className='h-3.5 w-3.5 text-orange-500' />
										<span>
											{new Date(interview.scheduled_start).toLocaleTimeString([], {
												hour: '2-digit',
												minute: '2-digit',
											})}
										</span>
									</div>

									<div className='flex items-center gap-2'>
										<Link
											href={`/interview/${interview.id}?isInterviewer=true`}
											target='_blank'
											className='mr-2 inline-flex items-center gap-1.5 rounded-md bg-green-600/10 px-2.5 py-1.5 text-xs font-medium text-green-500 border border-green-600/20 hover:bg-green-600/20 transition-colors'
											title='Join Interview Lobby'>
											<Video className='h-3.5 w-3.5' />
											Join Lobby
										</Link>
										<button
											onClick={() => handleResendEmail(interview.id, interview.candidate_email)}
											className='p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors'
											title='Resend Invitation Email'>
											<Send className='h-4 w-4' />
										</button>
										{['admin', 'recruiter'].includes(userRole) && (
											<>
												<button
													onClick={() => handleEditClick(interview)}
													className='p-1.5 text-slate-400 hover:text-orange-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors'
													title='Edit Interview'>
													<Edit2 className='h-4 w-4' />
												</button>
												<button
													onClick={() => handleDeleteInterview(interview.id)}
													className='p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors'
													title='Delete Interview'>
													<Trash2 className='h-4 w-4' />
												</button>
											</>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{isModalOpen && (
				<CreateInterviewModal
					onClose={handleCloseModal}
					onSubmit={handleCreateInterview}
					positions={positions}
					userRole={userRole}
					availableUsers={availableUsers}
					initialData={
						editingInterview
							? {
									candidateName: editingInterview.candidate_name,
									candidateEmail: editingInterview.candidate_email,
									positionId: editingInterview.position_id,
									date: new Date(editingInterview.scheduled_start).toISOString().split('T')[0],
									time: new Date(editingInterview.scheduled_start).toTimeString().substring(0, 5),
									interviewerIds: editingInterview.interviewer_ids || [],
							  }
							: undefined
					}
				/>
			)}
		</div>
	);
}
