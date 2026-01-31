'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
	ArrowLeft,
	Briefcase,
	Calendar,
	Clock,
	Mail,
	Search,
	User,
	Filter,
	MoreHorizontal,
	CheckCircle2,
	XCircle,
	Clock3,
} from 'lucide-react';
import { notFound, useParams } from 'next/navigation';

// Types (Ideally shared)
interface Skill {
	name: string;
	level: 'junior' | 'intermediate' | 'senior' | 'expert';
}

interface Requirements {
	skills: Skill[];
	interview_types: string[];
	evaluation_weights: Record<string, number>;
}

interface Position {
	id: string;
	title: string;
	requirements: Requirements;
	status: 'open' | 'closed';
	candidatesCount: number;
	description?: string;
}

interface Interview {
	id: string;
	candidateName: string;
	candidateEmail: string;
	date: string;
	time: string;
	status: 'scheduled' | 'completed' | 'cancelled';
	score?: number;
}

// Mock Data (Duplicated for now, ideally moved to a shared store/context)
const MOCK_POSITIONS: Position[] = [
	{
		id: '1',
		title: 'Senior Frontend Engineer',
		requirements: {
			skills: [
				{ name: 'React', level: 'senior' },
				{ name: 'TypeScript', level: 'senior' },
				{ name: 'Tailwind', level: 'intermediate' },
			],
			interview_types: ['technical', 'cultural_fit'],
			evaluation_weights: { communication: 0.3, problem_solving: 0.5, depth: 0.2 },
		},
		status: 'open',
		candidatesCount: 12,
		description:
			'We are looking for a Senior Frontend Engineer to join our team and help build the next generation of our product. You will be working with modern technologies like React, TypeScript, and Tailwind CSS.',
	},
	{
		id: '2',
		title: 'Product Designer',
		requirements: {
			skills: [
				{ name: 'Figma', level: 'senior' },
				{ name: 'UI/UX', level: 'senior' },
				{ name: 'Prototyping', level: 'intermediate' },
			],
			interview_types: ['portfolio_review', 'cultural_fit'],
			evaluation_weights: { communication: 0.4, problem_solving: 0.3, depth: 0.3 },
		},
		status: 'open',
		candidatesCount: 8,
		description:
			'Join our design team to create beautiful and intuitive user experiences. You should be proficient in Figma and have a strong portfolio.',
	},
	{
		id: '3',
		title: 'Backend Developer',
		requirements: {
			skills: [
				{ name: 'Go', level: 'intermediate' },
				{ name: 'PostgreSQL', level: 'senior' },
				{ name: 'Docker', level: 'intermediate' },
			],
			interview_types: ['technical', 'system_design'],
			evaluation_weights: { communication: 0.2, problem_solving: 0.5, depth: 0.3 },
		},
		status: 'closed',
		candidatesCount: 45,
		description:
			'We need a Backend Developer to scale our infrastructure. Experience with Go and distributed systems is a plus.',
	},
];

const MOCK_INTERVIEWS: Interview[] = [
	{
		id: '101',
		candidateName: 'John Doe',
		candidateEmail: 'john@example.com',
		date: '2024-02-15',
		time: '10:00',
		status: 'scheduled',
	},
	{
		id: '102',
		candidateName: 'Jane Smith',
		candidateEmail: 'jane@example.com',
		date: '2024-02-14',
		time: '14:30',
		status: 'completed',
		score: 8.5,
	},
	{
		id: '103',
		candidateName: 'Alice Johnson',
		candidateEmail: 'alice@example.com',
		date: '2024-02-16',
		time: '11:00',
		status: 'cancelled',
	},
	{
		id: '104',
		candidateName: 'Bob Brown',
		candidateEmail: 'bob@example.com',
		date: '2024-02-15',
		time: '09:00',
		status: 'scheduled',
	},
];

export default function PositionDetailsPage() {
	// In a real app, we fetch data based on params.positionId
	// Since this is a client component for now (marked by 'use client'), we can find it directly.

	const params = useParams();
	const positionId = typeof params.positionId === 'string' ? params.positionId : '';

	// We need to resolve the ID properly match the mock data
	const position = MOCK_POSITIONS.find((p) => p.id === positionId);

	const [searchTerm, setSearchTerm] = useState('');

	if (!position) {
		return (
			<div className='flex flex-col items-center justify-center p-12 text-center'>
				<h2 className='text-xl font-semibold text-white'>Position Not Found</h2>
				<Link
					href='/dashboard'
					className='mt-4 text-orange-500 hover:text-orange-400'>
					Return to Dashboard
				</Link>
			</div>
		);
	}

	// Filter interviews (mock logic - assuming all mock interviews belong to this position for demo purposes,
	// or we can just filter strictly if we added positionId to interviews. Let's filter by email for the requirement)
	const filteredInterviews = MOCK_INTERVIEWS.filter((interview) =>
		interview.candidateEmail.toLowerCase().includes(searchTerm.toLowerCase())
	);

	return (
		<div className='min-h-screen bg-slate-950 px-6 py-8'>
			{/* Header */}
			<div className='mb-8'>
				<Link
					href='/dashboard'
					className='inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-4'>
					<ArrowLeft className='mr-2 h-4 w-4' />
					Back to Dashboard
				</Link>
				<div className='flex items-start justify-between'>
					<div>
						<h1 className='text-3xl font-bold text-white tracking-tight'>{position.title}</h1>
						<div className='flex items-center gap-3 mt-3'>
							<div
								className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${
									position.status === 'open'
										? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
										: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
								}`}>
								<div
									className={`h-1.5 w-1.5 rounded-full ${
										position.status === 'open' ? 'bg-emerald-500' : 'bg-slate-500'
									}`}
								/>
								{position.status.toUpperCase()}
							</div>
							<span className='text-slate-500 text-sm flex items-center gap-1.5'>
								<User className='h-4 w-4' />
								{position.candidatesCount} Candidates
							</span>
						</div>
					</div>
					{/* Actions if needed */}
				</div>
			</div>

			<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
				{/* Main Content: Pipeline / Interviews */}
				<div className='lg:col-span-2 space-y-6'>
					<div className='flex items-center justify-between'>
						<h2 className='text-xl font-semibold text-white'>Interview Pipeline</h2>
						<div className='relative w-64'>
							<Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500' />
							<input
								type='text'
								placeholder='Search by candidate email...'
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className='w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'
							/>
						</div>
					</div>

					<div className='space-y-4'>
						{filteredInterviews.length === 0 ? (
							<div className='rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center'>
								<p className='text-slate-400'>No interviews found matching your search.</p>
							</div>
						) : (
							filteredInterviews.map((interview) => (
								<div
									key={interview.id}
									className='group rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-all hover:border-slate-700 hover:bg-slate-800/80'>
									<div className='flex items-start justify-between'>
										<div className='flex items-center gap-4'>
											<div className='flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-400 font-semibold border border-slate-700'>
												{interview.candidateName.charAt(0)}
											</div>
											<div>
												<h3 className='font-medium text-white'>{interview.candidateName}</h3>
												<p className='text-sm text-slate-400 flex items-center gap-1.5 mt-0.5'>
													<Mail className='h-3.5 w-3.5' />
													{interview.candidateEmail}
												</p>
											</div>
										</div>
										<div
											className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
												interview.status === 'completed'
													? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
													: interview.status === 'scheduled'
													? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
													: 'bg-red-500/10 text-red-400 border-red-500/20'
											}`}>
											{interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}
										</div>
									</div>

									<div className='mt-4 flex items-center justify-between border-t border-slate-800 pt-3'>
										<div className='flex items-center gap-4 text-sm text-slate-400'>
											<div className='flex items-center gap-1.5'>
												<Calendar className='h-4 w-4' />
												{new Date(interview.date).toLocaleDateString()}
											</div>
											<div className='flex items-center gap-1.5'>
												<Clock className='h-4 w-4' />
												{interview.time}
											</div>
										</div>
										{interview.score && (
											<div className='font-semibold text-white flex items-center gap-1.5'>
												Score: <span className='text-emerald-400'>{interview.score}/10</span>
											</div>
										)}
										<button className='text-sm font-medium text-orange-500 hover:text-orange-400 transition-colors'>
											View Details
										</button>
									</div>
								</div>
							))
						)}
					</div>
				</div>

				{/* Sidebar: Details & Requirements */}
				<div className='space-y-6'>
					{/* About */}
					<div className='rounded-xl border border-slate-800 bg-slate-900/50 p-6'>
						<h3 className='text-lg font-semibold text-white mb-4 flex items-center gap-2'>
							<Briefcase className='h-5 w-5 text-orange-500' />
							Use this template for
						</h3>
						<div className='flex flex-wrap gap-2'>
							{position.requirements.skills.map((skill, i) => (
								<span
									key={i}
									className='inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300 border border-slate-700'>
									{skill.name} • {skill.level}
								</span>
							))}
						</div>
					</div>

					{/* Interview Types */}
					<div className='rounded-xl border border-slate-800 bg-slate-900/50 p-6'>
						<h3 className='text-lg font-semibold text-white mb-4'>Interview Structure</h3>
						<ul className='space-y-3'>
							{position.requirements.interview_types.map((type, i) => (
								<li
									key={i}
									className='flex items-center gap-3 text-sm text-slate-300'>
									<div className='h-2 w-2 rounded-full bg-orange-500' />
									{type
										.split('_')
										.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
										.join(' ')}
								</li>
							))}
						</ul>
					</div>

					{/* Evaluation Weights */}
					<div className='rounded-xl border border-slate-800 bg-slate-900/50 p-6'>
						<h3 className='text-lg font-semibold text-white mb-4'>Evaluation Criteria</h3>
						<div className='space-y-4'>
							{Object.entries(position.requirements.evaluation_weights).map(([key, value]) => (
								<div key={key}>
									<div className='flex justify-between text-xs text-slate-400 mb-1.5'>
										<span className='uppercase'>{key.replace('_', ' ')}</span>
										<span>{(value as number) * 100}%</span>
									</div>
									<div className='h-1.5 w-full rounded-full bg-slate-800'>
										<div
											className='h-full rounded-full bg-blue-500'
											style={{ width: `${(value as number) * 100}%` }}
										/>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
