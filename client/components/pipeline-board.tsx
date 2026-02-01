'use client';

import { useEffect, useState } from 'react';
import { MoreHorizontal, Plus, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Stage {
	id: string;
	name: string;
	order_index: number;
}

interface Candidate {
	id: string;
	name: string;
	email: string;
	stage_id: string | null;
	stage_updated_at: string;
	last_interview_status?: string;
}

interface PipelineData {
	stages: Stage[];
	candidates: Candidate[];
}

export default function PipelineBoard({ positionId }: { positionId: string }) {
	const [data, setData] = useState<PipelineData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [movingId, setMovingId] = useState<string | null>(null);
	const [initializing, setInitializing] = useState(false);

	const fetchPipeline = async () => {
		try {
			const { data } = await api.get(`/positions/${positionId}/pipeline`);
			setData(data);
		} catch (err: any) {
			setError(err.message || 'Failed to fetch pipeline');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchPipeline();
	}, [positionId]);

	const initializeDefaultStages = async () => {
		setInitializing(true);
		try {
			const defaultStages = [
				{ name: 'Applied' },
				{ name: 'Screening' },
				{ name: 'Interview' },
				{ name: 'Offer' },
				{ name: 'Hired' },
				{ name: 'Rejected' },
			];

			await api.put(`/positions/${positionId}/pipeline`, { stages: defaultStages });

			await fetchPipeline();
			toast.success('Pipeline initialized');
		} catch (err) {
			toast.error('Failed to initialize pipeline');
		} finally {
			setInitializing(false);
		}
	};

	const handleMoveCandidate = async (candidateId: string, stageId: string) => {
		setMovingId(candidateId);
		try {
			await api.post(`/positions/${positionId}/move`, { candidateId, stageId });

			// Optimistic update or refetch
			await fetchPipeline();
			toast.success('Candidate moved');
		} catch (err) {
			toast.error('Failed to move candidate');
		} finally {
			setMovingId(null);
		}
	};

	if (loading) return <div className='p-8 text-center text-slate-500'>Loading pipeline...</div>;
	if (error)
		return (
			<div className='p-8 text-center text-red-400 bg-red-500/10 rounded-xl border border-red-500/20'>
				<AlertCircle className='h-6 w-6 mx-auto mb-2' />
				{error}
			</div>
		);

	if (!data) return null;

	const { stages, candidates } = data;

	// If no stages, show message with functionality
	if (stages.length === 0) {
		return (
			<div className='p-12 text-center border border-dashed border-slate-700 rounded-xl'>
				<p className='text-slate-400 mb-4'>No pipeline stages defined for this position.</p>
				<button
					onClick={initializeDefaultStages}
					disabled={initializing}
					className='px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition disabled:opacity-50'>
					{initializing ? 'Initializing...' : 'Initialize Default Pipeline'}
				</button>
			</div>
		);
	}

	// Group candidates by stage
	// Candidates with null stage_id go to "Unassigned" or first stage?
	// Usually they go to "Applied" or similar.
	// We'll create a map where we put candidates into their stages.
	// If a candidate has a stage_id that doesn't exist in stages list, we might want a "Lost" column or just ignore.
	const candidatesByStage: Record<string, Candidate[]> = {};
	stages.forEach((s) => (candidatesByStage[s.id] = []));

	// Also handle candidates with no stage
	const unassigned: Candidate[] = [];

	candidates.forEach((c) => {
		if (c.stage_id && candidatesByStage[c.stage_id]) {
			candidatesByStage[c.stage_id].push(c);
		} else {
			unassigned.push(c);
		}
	});

	// If unassigned has candidates, valid question where to put them.
	// Maybe we assume the first stage is "default" if stage_id is null?
	// Or we show an "Unassigned" column.
	// For now, let's prepend an "Unassigned" column if there carry-overs.

	return (
		<div className='flex gap-4 overflow-x-auto pb-6'>
			{unassigned.length > 0 && (
				<div className='min-w-[300px] max-w-[300px] shrink-0 flex flex-col'>
					<div className='flex items-center justify-between mb-4 px-2'>
						<div className='flex items-center gap-2'>
							<h3 className='font-medium text-slate-300'>Unassigned</h3>
							<span className='bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full'>{unassigned.length}</span>
						</div>
					</div>
					<div className='flex-1 bg-slate-900/30 rounded-xl border border-slate-800/50 p-3 space-y-3 min-h-[200px]'>
						{unassigned.map((c) => (
							<CandidateCard
								key={c.id}
								candidate={c}
								stages={stages}
								onMove={handleMoveCandidate}
								isMoving={movingId === c.id}
							/>
						))}
					</div>
				</div>
			)}

			{stages.map((stage) => (
				<div
					key={stage.id}
					className='min-w-[300px] max-w-[300px] shrink-0 flex flex-col'>
					<div className='flex items-center justify-between mb-4 px-2'>
						<div className='flex items-center gap-2'>
							<h3 className='font-medium text-white'>{stage.name}</h3>
							<span className='bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full'>
								{candidatesByStage[stage.id].length}
							</span>
						</div>
						<button className='text-slate-500 hover:text-white'>
							<MoreHorizontal className='h-4 w-4' />
						</button>
					</div>

					<div className='flex-1 bg-slate-900/30 rounded-xl border border-slate-800/50 p-3 space-y-3 min-h-[200px]'>
						{candidatesByStage[stage.id].map((candidate) => (
							<CandidateCard
								key={candidate.id}
								candidate={candidate}
								stages={stages}
								onMove={handleMoveCandidate}
								isMoving={movingId === candidate.id}
							/>
						))}
					</div>
				</div>
			))}

			{/* Add Stage Button Placeholder */}
			<div className='min-w-[300px] shrink-0 flex items-start justify-center pt-10 opacity-50 hover:opacity-100 transition-opacity'>
				<button className='flex items-center gap-2 text-slate-500 hover:text-white border border-dashed border-slate-700 hover:border-slate-500 rounded-lg px-6 py-3 transition-colors'>
					<Plus className='h-4 w-4' />
					Add Stage
				</button>
			</div>
		</div>
	);
}

function CandidateCard({
	candidate,
	stages,
	onMove,
	isMoving,
}: {
	candidate: Candidate;
	stages: Stage[];
	onMove: (cid: string, sid: string) => void;
	isMoving: boolean;
}) {
	return (
		<div
			className={`bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-sm group ${isMoving ? 'opacity-50' : ''}`}>
			<div className='flex items-start justify-between mb-2'>
				<div className='flex items-center gap-2'>
					<div className='h-6 w-6 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-xs font-bold border border-orange-500/20'>
						{candidate.name.charAt(0)}
					</div>
					<span className='font-medium text-sm text-white truncate max-w-[120px]'>{candidate.name}</span>
				</div>
				{/* Move Dropdown (Simple for now) */}
				<select
					className='text-[10px] bg-slate-900 border border-slate-700 text-slate-400 rounded px-1 py-0.5 max-w-[80px] hover:text-white cursor-pointer'
					value={candidate.stage_id || ''}
					onChange={(e) => onMove(candidate.id, e.target.value)}>
					<option
						value=''
						disabled>
						Move...
					</option>
					{stages.map((s) => (
						<option
							key={s.id}
							value={s.id}>
							{s.name}
						</option>
					))}
				</select>
			</div>
			<div className='text-xs text-slate-500 mb-2 truncate'>{candidate.email}</div>
			{candidate.last_interview_status && (
				<div className='inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-700/50 text-slate-400 border border-slate-700'>
					Status: {candidate.last_interview_status}
				</div>
			)}
		</div>
	);
}
