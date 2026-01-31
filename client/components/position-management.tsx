'use client';

import { useState } from 'react';
import { Briefcase, Plus, Search, Edit2 } from 'lucide-react';
import Link from 'next/link';
import AddPositionModal, { PositionFormData, RequirementsSchema } from './add-position-modal';

interface Position {
	id: string;
	title: string;
	requirements: RequirementsSchema;
	status: 'open' | 'closed';
	candidatesCount: number;
}

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
	},
];

export default function PositionManagement() {
	const [positions, setPositions] = useState<Position[]>(MOCK_POSITIONS);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingPosition, setEditingPosition] = useState<Position | null>(null);
	const [searchTerm, setSearchTerm] = useState('');

	const handleSavePosition = (data: PositionFormData) => {
		if (editingPosition) {
			// Update existing
			setPositions(positions.map((p) => (p.id === editingPosition.id ? { ...p, ...data } : p)));
			setEditingPosition(null);
		} else {
			// Create new
			const newPosition: Position = {
				id: Math.random().toString(36).substr(2, 9),
				title: data.title,
				requirements: data.requirements,
				status: data.status,
				candidatesCount: 0,
			};
			setPositions([newPosition, ...positions]);
		}
		setIsModalOpen(false);
	};

	const handleEditPosition = (position: Position) => {
		setEditingPosition(position);
		setIsModalOpen(true);
	};

	const filteredPositions = positions.filter((pos) => pos.title.toLowerCase().includes(searchTerm.toLowerCase()));

	return (
		<div className='mt-8 flex flex-col gap-6'>
			{/* Header Section */}
			<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
				<div>
					<h2 className='text-xl font-semibold text-white'>Open Positions</h2>
					<p className='mt-1 text-sm text-slate-400'>Manage hiring roles and view candidate pipelines.</p>
				</div>
				<button
					onClick={() => {
						setEditingPosition(null);
						setIsModalOpen(true);
					}}
					className='inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900'>
					<Plus className='mr-2 h-4 w-4' />
					Add Position
				</button>
			</div>

			{/* Search Bar */}
			<div className='relative'>
				<Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500' />
				<input
					type='text'
					placeholder='Search positions...'
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className='w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-colors focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'
				/>
			</div>

			{/* Positions Grid */}
			<div className='grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3'>
				{filteredPositions.map((pos) => (
					<div
						key={pos.id}
						className='group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition-all hover:border-slate-700 hover:bg-slate-800/50 hover:shadow-md'>
						<div className='flex items-start justify-between'>
							<div className='flex items-center gap-3'>
								<div className='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20'>
									<Briefcase className='h-5 w-5' />
								</div>
								<div>
									<h3 className='font-medium text-white group-hover:text-orange-400 transition-colors'>{pos.title}</h3>
									<div
										className={`flex items-center gap-2 text-xs font-medium mt-1 ${
											pos.status === 'open' ? 'text-emerald-500' : 'text-slate-500'
										}`}>
										<div
											className={`h-1.5 w-1.5 rounded-full ${
												pos.status === 'open' ? 'bg-emerald-500' : 'bg-slate-500'
											}`}
										/>
										{pos.status.toUpperCase()}
									</div>
								</div>
							</div>

							<button
								onClick={() => handleEditPosition(pos)}
								className='rounded p-1.5 text-slate-500 opacity-0 transition-opacity hover:bg-blue-500/10 hover:text-blue-500 group-hover:opacity-100'
								title='Edit Position'>
								<Edit2 className='h-4 w-4' />
							</button>
						</div>

						{/* Requirements Tags */}
						<div className='mt-4 flex flex-wrap gap-2'>
							{pos.requirements.skills.slice(0, 3).map((skill, i) => (
								<span
									key={i}
									className='inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-400 border border-slate-700'>
									{skill.name}
								</span>
							))}
							{pos.requirements.skills.length > 3 && (
								<span className='inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-400 border border-slate-700'>
									+{pos.requirements.skills.length - 3} more
								</span>
							)}
						</div>

						<div className='mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-sm'>
							<span className='text-slate-400'>
								<strong className='text-white'>{pos.candidatesCount}</strong> Candidates
							</span>
							<Link
								href={`/dashboard/position/${pos.id}`}
								className='text-orange-500 hover:text-orange-400 font-medium text-xs uppercase tracking-wide'>
								View Pipeline →
							</Link>
						</div>
					</div>
				))}
			</div>

			{isModalOpen && (
				<AddPositionModal
					onClose={() => {
						setIsModalOpen(false);
						setEditingPosition(null);
					}}
					onSubmit={handleSavePosition}
					initialData={editingPosition || undefined}
				/>
			)}
		</div>
	);
}
