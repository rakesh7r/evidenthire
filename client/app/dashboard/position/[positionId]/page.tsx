'use client';

import api from '@/lib/api';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Briefcase, User, AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import CandidateInterviews from '@/components/candidate-interviews';

interface Skill {
	name: string;
	level: 'junior' | 'intermediate' | 'senior' | 'expert';
}

interface Requirements {
	skills?: Skill[];
	interview_types?: string[];
	evaluation_weights?: Record<string, number>;
}

interface Position {
	id: string;
	title: string;
	requirements?: Requirements;
	status: 'open' | 'closed';
	description?: string;
	// Extra fields from join or separate stats call if needed,
	// but getPositionById only returns * from position table.
	// We might need to fetch candidate count separately or let PipelineBoard handle it.
}

export default function PositionDetailsPage() {
	const params = useParams();
	const positionId = typeof params.positionId === 'string' ? params.positionId : '';

	const [position, setPosition] = useState<Position | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

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

	if (loading) {
		return <div className='p-12 text-center text-slate-500'>Loading position...</div>;
	}

	if (error || !position) {
		return (
			<div className='flex flex-col items-center justify-center p-12 text-center'>
				<h2 className='text-xl font-semibold text-white'>Position Not Found</h2>
				<p className='text-slate-500 mb-4'>{error}</p>
				<Link
					href='/dashboard'
					className='mt-4 text-orange-500 hover:text-orange-400'>
					Return to Dashboard
				</Link>
			</div>
		);
	}

	// Default requirements if missing/empty
	const requirements = position.requirements || {};
	const skills = requirements.skills || [];
	const interviewTypes = requirements.interview_types || [];
	const weights = requirements.evaluation_weights || {};

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
						</div>
					</div>
					{/* Actions like Edit Position could go here */}
				</div>
			</div>

			<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
				{/* Main Content: Interviews & Reports */}
				<div className='lg:col-span-2 space-y-6'>
					<div className='flex items-center justify-between'>
						<h2 className='text-xl font-semibold text-white'>Candidates & Interviews</h2>
					</div>

					<CandidateInterviews positionId={positionId} />
				</div>

				{/* Sidebar: Details & Requirements */}
				<div className='space-y-6'>
					{/* Skills */}
					{skills.length > 0 && (
						<div className='rounded-xl border border-slate-800 bg-slate-900/50 p-6'>
							<h3 className='text-lg font-semibold text-white mb-4 flex items-center gap-2'>
								<Briefcase className='h-5 w-5 text-orange-500' />
								Required Skills
							</h3>
							<div className='flex flex-wrap gap-2'>
								{skills.map((skill, i) => (
									<span
										key={i}
										className='inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300 border border-slate-700'>
										{skill.name} • {skill.level}
									</span>
								))}
							</div>
						</div>
					)}

					{/* Interview Types */}
					{interviewTypes.length > 0 && (
						<div className='rounded-xl border border-slate-800 bg-slate-900/50 p-6'>
							<h3 className='text-lg font-semibold text-white mb-4'>Interview Structure</h3>
							<ul className='space-y-3'>
								{interviewTypes.map((type, i) => (
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
					)}

					{/* Evaluation Weights */}
					{Object.keys(weights).length > 0 && (
						<div className='rounded-xl border border-slate-800 bg-slate-900/50 p-6'>
							<h3 className='text-lg font-semibold text-white mb-4'>Evaluation Criteria</h3>
							<div className='space-y-4'>
								{Object.entries(weights).map(([key, value]) => (
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
					)}

					{/* Fallback if no requirements */}
					{skills.length === 0 && interviewTypes.length === 0 && Object.keys(weights).length === 0 && (
						<div className='rounded-xl border border-dashed border-slate-800 p-6 text-center text-slate-500'>
							No specific requirements defined for this position.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
