'use client';

import { useState } from 'react';
import { FileText, User, Plus, Calendar, Clock, Briefcase, Edit2, Send, Users } from 'lucide-react';
import CreateInterviewModal, { SimpleUser } from './create-interview-modal';
import { Position, UserRole } from '@/types/db';

// Mock positions data
const MOCK_POSITIONS: Position[] = [
	{
		id: '1',
		title: 'Senior Frontend Engineer',
		status: 'open',
		created_at: new Date().toISOString(),
	},
	{
		id: '2',
		title: 'Product Designer',
		status: 'open',
		created_at: new Date().toISOString(),
	},
	{
		id: '3',
		title: 'Backend Developer',
		status: 'closed',
		created_at: new Date().toISOString(),
	},
];

// Mock users data
const MOCK_USERS: SimpleUser[] = [
	{
		id: '1',
		name: 'Alex Johnson',
		email: 'alex@acme.inc',
	},
	{
		id: '2',
		name: 'Sarah Smith',
		email: 'sarah@acme.inc',
	},
	{
		id: '3',
		name: 'Mike Chen',
		email: 'mike@acme.inc',
	},
	{
		id: '4',
		name: 'Emily Davis',
		email: 'emily@acme.inc',
	},
];

interface Participant {
	id: string;
	candidateName: string;
	candidateEmail: string;
	positionId: string;
	date: string;
	time: string;
	interviewers?: string[];
}

export default function InterviewList() {
	const [isModalOpen, setIsModalOpen] = useState(false);
	// Mock user role
	const userRole: UserRole = 'recruiter';

	// Add state for editing
	const [editingInterview, setEditingInterview] = useState<Participant | null>(null);

	const [interviews, setInterviews] = useState<Participant[]>([]);

	const handleCreateInterview = (data: any) => {
		if (editingInterview) {
			// Update mode
			setInterviews(interviews.map((i) => (i.id === editingInterview.id ? { ...i, ...data } : i)));
			setEditingInterview(null);
		} else {
			// Create mode
			const newInterview: Participant = {
				id: Math.random().toString(36).substr(2, 9),
				...data,
			};
			setInterviews([newInterview, ...interviews]);
		}
		setIsModalOpen(false);
	};

	const handleEditClick = (interview: Participant) => {
		setEditingInterview(interview);
		setIsModalOpen(true);
	};

	const handleResendEmail = (email: string) => {
		// Mock resend email
		alert(`Invitation email re-sent to ${email}`);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		setEditingInterview(null);
	};

	const getPositionTitle = (id: string) => {
		return MOCK_POSITIONS.find((p) => p.id === id)?.title || 'Unknown Position';
	};

	return (
		<div className='mt-8 rounded-xl border border-slate-700 bg-slate-800 shadow-sm'>
			<div className='flex items-center justify-between border-b border-slate-700 px-6 py-4'>
				<h3 className='text-base font-semibold leading-6 text-white'>Recent Interviews</h3>
				<button
					onClick={() => {
						setEditingInterview(null);
						setIsModalOpen(true);
					}}
					className='inline-flex items-center rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600'>
					<Plus className='-ml-0.5 mr-1.5 h-4 w-4' />
					New Interview
				</button>
			</div>

			<div className='p-6'>
				{interviews.length === 0 ? (
					<div className='text-center py-6'>
						<div className='mx-auto h-24 w-24 rounded-full bg-slate-700/50 flex items-center justify-center mb-4'>
							<FileText className='h-10 w-10 text-slate-500' />
						</div>
						<h3 className='mt-2 text-sm font-medium text-white'>No interviews yet</h3>
						<p className='mt-1 text-sm text-slate-400'>Get started by creating a new interview pipeline.</p>
					</div>
				) : (
					<div className='space-y-4'>
						{interviews.map((interview) => (
							<div
								key={interview.id}
								className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4 transition-colors hover:bg-slate-700/50'>
								<div className='flex items-start gap-4'>
									<div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20'>
										<User className='h-5 w-5' />
									</div>
									<div>
										<h4 className='font-medium text-white'>{interview.candidateName}</h4>
										<p className='text-sm text-slate-400'>{interview.candidateEmail}</p>
										<div className='mt-1 flex items-center gap-4 text-xs text-slate-500'>
											<span className='flex items-center gap-1.5'>
												<Briefcase className='h-3 w-3' />
												{getPositionTitle(interview.positionId)}
											</span>
											{interview.interviewers && interview.interviewers.length > 0 && (
												<span className='flex items-center gap-1.5 text-slate-400'>
													<Users className='h-3 w-3' />
													{interview.interviewers.length} Interviewer(s)
												</span>
											)}
										</div>
									</div>
								</div>

								<div className='flex flex-col items-end gap-3 sm:flex-row sm:items-center'>
									<div className='flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 border border-slate-700 text-xs text-slate-300'>
										<Calendar className='h-3.5 w-3.5 text-orange-500' />
										<span>{new Date(interview.date).toLocaleDateString()}</span>
										<span className='w-px h-3 bg-slate-700 mx-1'></span>
										<Clock className='h-3.5 w-3.5 text-orange-500' />
										<span>{interview.time}</span>
									</div>

									<div className='flex items-center gap-2'>
										<button
											onClick={() => handleResendEmail(interview.candidateEmail)}
											className='p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-md transition-colors'
											title='Resend Invitation Email'>
											<Send className='h-4 w-4' />
										</button>
										<button
											onClick={() => handleEditClick(interview)}
											className='p-1.5 text-slate-400 hover:text-orange-400 hover:bg-slate-800 rounded-md transition-colors'
											title='Edit Interview'>
											<Edit2 className='h-4 w-4' />
										</button>
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
					positions={MOCK_POSITIONS}
					userRole={userRole}
					availableUsers={MOCK_USERS}
					initialData={
						editingInterview
							? {
									candidateName: editingInterview.candidateName,
									candidateEmail: editingInterview.candidateEmail,
									positionId: editingInterview.positionId,
									date: editingInterview.date,
									time: editingInterview.time,
									interviewerIds: editingInterview.interviewers || [],
							  }
							: undefined
					}
				/>
			)}
		</div>
	);
}
