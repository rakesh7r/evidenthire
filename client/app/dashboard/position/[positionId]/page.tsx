'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Briefcase, User, AlertCircle, LayoutGrid, Users } from 'lucide-react';
import CandidateInterviews from '@/components/candidate-interviews';
import ApplicationsList from '@/components/applications-list';
import SchedulerModal from '@/components/interview-scheduler-modal';
import RecruitingChatbot from '@/components/recruiting-chatbot';
import { ThemeToggle } from '@/components/theme-toggle';
import api from '@/lib/api';
import { Position } from '@/types/db';

export default function PositionDetailsPage() {
	const params = useParams();
	const positionId = typeof params.positionId === 'string' ? params.positionId : '';

	const [position, setPosition] = useState<Position | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [activeTab, setActiveTab] = useState<'applications' | 'interviews'>('applications');
	const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
	const [selectedCandidateName, setSelectedCandidateName] = useState('');
	const [selectedCandidateEmail, setSelectedCandidateEmail] = useState('');
	const [selectedRound, setSelectedRound] = useState('');
	const [applicationsCount, setApplicationsCount] = useState(0);
	const [refreshKey, setRefreshKey] = useState(0);

	useEffect(() => {
		if (!positionId) return;

		const fetchPosition = async () => {
			try {
				const { data } = await api.get(`/positions/${positionId}`);
				setPosition(data);
			} catch (err: any) {
				setError(err.message || 'Failed to fetch position');
			} finally {
				setLoading(false);
			}
		};

		fetchPosition();
	}, [positionId]);

	const handleScheduleInterview = (app: any) => {
		setSelectedCandidateName(app.name);
		setSelectedCandidateEmail(app.email);
		setIsSchedulerOpen(true);
	};

	const handleScheduleSuccess = () => {
		setRefreshKey((prev) => prev + 1);
	};

	if (loading) {
		return (
			<div className='flex h-screen items-center justify-center bg-white dark:bg-slate-950'>
				<div className='flex flex-col items-center gap-4'>
					<div className='h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent' />
					<p className='text-slate-500'>Loading position details...</p>
				</div>
			</div>
		);
	}

	if (error || !position) {
		return (
			<div className='flex min-h-screen flex-col items-center justify-center bg-white dark:bg-slate-950 p-12 text-center'>
				<div className='rounded-full bg-red-100 p-3 dark:bg-red-900/20 mb-4'>
					<AlertCircle className='h-8 w-8 text-red-600 dark:text-red-400' />
				</div>
				<h2 className='text-xl font-semibold text-slate-900 dark:text-white'>Position Not Found</h2>
				<p className='text-slate-500 mb-6'>{error}</p>
				<Link
					href='/dashboard'
					className='text-sm font-medium text-orange-600 hover:text-orange-500 dark:text-orange-400'>
					Return to Dashboard
				</Link>
			</div>
		);
	}

	// Default requirements if missing/empty
	const requirements = position.requirements || {
		skills: [],
		interview_types: [],
		evaluation_weights: { communication: 0, problem_solving: 0, depth: 0 },
	};
	const skills = requirements.skills || [];

	// Prioritize official 'rounds' from API, fallback to interview_types
	const interviewRounds =
		position.rounds && position.rounds.length > 0 ? position.rounds : requirements.interview_types || [];

	const weights = requirements.evaluation_weights || {};

	return (
		<div className='min-h-screen bg-slate-50/50 dark:bg-slate-950 px-6 py-8 transition-colors duration-300'>
			{/* Header */}
			<div className='mx-auto max-w-7xl mb-8'>
				<div className='mb-6 flex items-center justify-between'>
					<Link
						href='/dashboard'
						className='group inline-flex items-center text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors'>
						<ArrowLeft className='mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1' />
						Back to Dashboard
					</Link>
					<ThemeToggle />
				</div>

				<div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
					<div>
						<div className='flex items-center gap-3'>
							<h1 className='text-3xl font-bold text-slate-900 dark:text-white tracking-tight'>{position.title}</h1>
							<div
								className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
									position.status === 'open'
										? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
										: 'bg-slate-500/10 text-slate-500 border-slate-500/20'
								}`}>
								<span
									className={`h-1.5 w-1.5 rounded-full ${
										position.status === 'open' ? 'bg-emerald-500' : 'bg-slate-500'
									}`}
								/>
								{position.status.toUpperCase()}
							</div>
						</div>
						<p className='mt-2 text-slate-500 dark:text-slate-400 max-w-2xl'>
							Manage candidates, schedule interviews, and track hiring progress for this role.
						</p>
					</div>

					{/* Tabs Navigation */}
					<div className='flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm'>
						<button
							onClick={() => setActiveTab('applications')}
							className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
								activeTab === 'applications'
									? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-sm'
									: 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
							}`}>
							<Users className='h-4 w-4' />
							Applications
						</button>
						<button
							onClick={() => setActiveTab('interviews')}
							className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
								activeTab === 'interviews'
									? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-sm'
									: 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
							}`}>
							<LayoutGrid className='h-4 w-4' />
							Interviews
						</button>
					</div>
				</div>
			</div>

			<div className='mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8'>
				{/* Main Content Area */}
				<div className='lg:col-span-2 space-y-6'>
					{activeTab === 'applications' ? (
						<div className='animate-in fade-in slide-in-from-left-4 duration-300'>
							<div className='flex items-center justify-between mb-4'>
								<h2 className='text-lg font-semibold text-slate-900 dark:text-white'>Recent Applications</h2>
								<span className='text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md'>
									Total: {applicationsCount}
								</span>
							</div>
							<ApplicationsList
								key={refreshKey}
								positionId={positionId}
								onSchedule={handleScheduleInterview}
								onTotalChange={setApplicationsCount}
							/>
						</div>
					) : (
						<div className='animate-in fade-in slide-in-from-right-4 duration-300'>
							<div className='flex items-center justify-between mb-4'>
								<h2 className='text-lg font-semibold text-slate-900 dark:text-white'>Scheduled Interviews</h2>
							</div>
							<CandidateInterviews
								positionId={positionId}
								onReschedule={(name, email, type) => {
									setSelectedCandidateName(name);
									setSelectedCandidateEmail(email);
									setSelectedRound(type || '');
									setIsSchedulerOpen(true);
								}}
							/>
						</div>
					)}
				</div>

				{/* Right Sidebar */}
				<div className='space-y-6'>
					{/* Position Details Card */}
					<div className='rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'>
						<div className='p-4 border-b border-slate-100 dark:border-slate-800'>
							<h3 className='font-semibold text-slate-900 dark:text-white flex items-center gap-2'>
								<Briefcase className='h-4 w-4 text-slate-500' />
								Position Requirements
							</h3>
						</div>

						<div className='p-4 space-y-6'>
							{/* Skills */}
							{skills.length > 0 && (
								<div>
									<h4 className='text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3'>
										Required Skills
									</h4>
									<div className='flex flex-wrap gap-2'>
										{skills.map((skill, i) => (
											<span
												key={i}
												className='inline-flex items-center rounded-md bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'>
												{skill.name} <span className='mx-1 text-slate-300'>•</span> {skill.level}
											</span>
										))}
									</div>
								</div>
							)}

							{/* Interview Structure */}
							{interviewRounds.length > 0 && (
								<div>
									<h4 className='text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3'>Structure</h4>
									<ul className='space-y-2'>
										{interviewRounds.map((type, i) => {
											const title = typeof type === 'string' ? type : type.title;
											return (
												<li
													key={i}
													className='flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400'>
													<div className='h-1.5 w-1.5 rounded-full bg-orange-500' />
													<span className='capitalize'>{title.replace('_', ' ')}</span>
												</li>
											);
										})}
									</ul>
								</div>
							)}

							{/* Evaluation Weights */}
							{Object.keys(weights).length > 0 && (
								<div>
									<h4 className='text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3'>Weights</h4>
									<div className='space-y-3'>
										{Object.entries(weights).map(([key, value]) => (
											<div key={key}>
												<div className='flex justify-between text-xs text-slate-500 mb-1'>
													<span className='capitalize'>{key.replace('_', ' ')}</span>
													<span className='font-medium'>{(value as number) * 100}%</span>
												</div>
												<div className='h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden'>
													<div
														className='h-full rounded-full bg-blue-500/80'
														style={{ width: `${(value as number) * 100}%` }}
													/>
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Scheduler Modal */}
			{isSchedulerOpen && (
				<SchedulerModal
					candidateName={selectedCandidateName}
					candidateEmail={selectedCandidateEmail}
					positionId={positionId}
					rounds={interviewRounds}
					defaultRound={selectedRound}
					onClose={() => {
						setIsSchedulerOpen(false);
						setSelectedRound('');
					}}
					onSuccess={handleScheduleSuccess}
				/>
			)}

			{/* AI Recruiting Chatbot */}
			{position && (
				<RecruitingChatbot
					positionId={positionId}
					positionTitle={position.title}
				/>
			)}
		</div>
	);
}
