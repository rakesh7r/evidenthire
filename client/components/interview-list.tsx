'use client';

import { useState } from 'react';
import { FileText, User, Plus, Calendar, Clock, Briefcase } from 'lucide-react';
import CreateInterviewModal, { SimpleUser } from './create-interview-modal';
import { Position, UserRole, Interview } from '@/types/db';

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

	const [interviews, setInterviews] = useState<Participant[]>([]);

	const handleCreateInterview = (data: any) => {
		console.log('Creating interview with data:', data);

		const newInterview: Participant = {
			id: Math.random().toString(36).substr(2, 9),
			...data,
		};

		setInterviews([newInterview, ...interviews]);
	};

	const getPositionTitle = (id: string) => {
		return MOCK_POSITIONS.find((p) => p.id === id)?.title || 'Unknown Position';
	};

	return (
		<div className='mt-8 rounded-xl border border-slate-700 bg-slate-800 shadow-sm'>
			<div className='flex items-center justify-between border-b border-slate-700 px-6 py-4'>
				<h3 className='text-base font-semibold leading-6 text-white'>Recent Interviews</h3>
				<button
					onClick={() => setIsModalOpen(true)}
					className='inline-flex items-center rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600'>
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
										</div>
									</div>
								</div>

								<div className='flex items-center gap-6 text-sm text-slate-300'>
									<div className='flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 border border-slate-700'>
										<Calendar className='h-4 w-4 text-orange-500' />
										<span>{new Date(interview.date).toLocaleDateString()}</span>
										<span className='w-px h-3 bg-slate-700 mx-1'></span>
										<Clock className='h-4 w-4 text-orange-500' />
										<span>{interview.time}</span>
									</div>
									<button className='text-orange-500 font-medium hover:text-orange-400 text-xs uppercase tracking-wide'>
										View Details
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{isModalOpen && (
				<CreateInterviewModal
					onClose={() => setIsModalOpen(false)}
					onSubmit={handleCreateInterview}
					positions={MOCK_POSITIONS}
					userRole={userRole}
					availableUsers={MOCK_USERS}
				/>
			)}
		</div>
	);
}
