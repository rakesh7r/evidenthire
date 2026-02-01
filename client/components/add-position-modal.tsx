'use client';

import { useState } from 'react';
import { Plus, X, Briefcase, FileText, CheckCircle, Tag, Sliders, Brain } from 'lucide-react';

interface PositionFormProps {
	onClose: () => void;
	onSubmit: (data: PositionFormData) => void;
	initialData?: PositionFormData;
}

export type SkillLevel = 'basic' | 'intermediate' | 'senior';

export interface SkillRequirement {
	name: string;
	level: SkillLevel;
}

export interface EvaluationWeights {
	communication: number;
	problem_solving: number;
	depth: number;
}

export interface RequirementsSchema {
	skills: SkillRequirement[];
	interview_types: string[];
	evaluation_weights: EvaluationWeights;
}

// Current DB schema is just JSONB, but we will serialize this structure into it.
export interface PositionFormData {
	title: string;
	requirements: RequirementsSchema;
	status: 'open' | 'closed';
}

const INTERVIEW_TYPES_OPTIONS = ['technical', 'system_design', 'cultural_fit', 'managerial'];

export default function AddPositionModal({ onClose, onSubmit, initialData }: PositionFormProps) {
	const [title, setTitle] = useState(initialData?.title || '');
	const [status, setStatus] = useState<'open' | 'closed'>(initialData?.status || 'open');

	// Requirements State
	const [skills, setSkills] = useState<SkillRequirement[]>(initialData?.requirements.skills || []);
	const [newSkillName, setNewSkillName] = useState('');
	const [newSkillLevel, setNewSkillLevel] = useState<SkillLevel>('intermediate');
	const [selectedInterviewTypes, setSelectedInterviewTypes] = useState<string[]>(
		initialData?.requirements.interview_types || []
	);
	const [weights, setWeights] = useState<EvaluationWeights>(
		initialData?.requirements.evaluation_weights || {
			communication: 0.3,
			problem_solving: 0.4,
			depth: 0.3,
		}
	);

	const handleAddSkill = () => {
		if (newSkillName.trim()) {
			setSkills([...skills, { name: newSkillName.trim(), level: newSkillLevel }]);
			setNewSkillName('');
			setNewSkillLevel('intermediate');
		}
	};

	const removeSkill = (index: number) => {
		setSkills(skills.filter((_, i) => i !== index));
	};

	const toggleInterviewType = (type: string) => {
		if (selectedInterviewTypes.includes(type)) {
			setSelectedInterviewTypes(selectedInterviewTypes.filter((t) => t !== type));
		} else {
			setSelectedInterviewTypes([...selectedInterviewTypes, type]);
		}
	};

	const handleWeightChange = (key: keyof EvaluationWeights, value: number) => {
		setWeights({
			...weights,
			[key]: value,
		});
	};

	const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
		if (e) e.preventDefault();
		onSubmit({
			title,
			requirements: {
				skills,
				interview_types: selectedInterviewTypes,
				evaluation_weights: weights,
			},
			status,
		});
		onClose();
	};

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
			<div className='w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col'>
				<div className='relative border-b border-slate-200 dark:border-slate-800 p-6 shrink-0'>
					<h3 className='text-xl font-semibold text-slate-900 dark:text-white'>
						{initialData ? 'Edit Position' : 'Create New Position'}
					</h3>
					<p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>
						Configure role details, technical requirements and evaluation criteria.
					</p>
					<button
						onClick={onClose}
						className='absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors'>
						<X className='h-5 w-5' />
					</button>
				</div>

				<form
					onSubmit={handleSubmit}
					className='p-6 space-y-8 overflow-y-auto'>
					{/* Basic Info */}
					<div className='space-y-4'>
						<h4 className='text-sm font-semibold text-orange-500 uppercase tracking-wider'>Role Details</h4>
						<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
							<div className='space-y-2'>
								<label className='text-sm font-medium text-slate-700 dark:text-slate-300'>Job Title</label>
								<div className='relative'>
									<Briefcase className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500' />
									<input
										type='text'
										required
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										className='w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'
										placeholder='e.g., Stafr Engineer'
									/>
								</div>
							</div>

							<div className='space-y-2'>
								<label className='text-sm font-medium text-slate-700 dark:text-slate-300'>Status</label>
								<div className='flex gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700'>
									{['open', 'closed'].map((s) => (
										<button
											key={s}
											type='button'
											onClick={() => setStatus(s as any)}
											className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-all ${
												status === s
													? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
													: 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
											}`}>
											{s}
										</button>
									))}
								</div>
							</div>
						</div>
					</div>

					{/* Skills */}
					<div className='space-y-4'>
						<h4 className='text-sm font-semibold text-orange-600 dark:text-orange-500 uppercase tracking-wider flex items-center gap-2'>
							<Brain className='h-4 w-4' /> Skills Requirements
						</h4>
						<div className='bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 space-y-4'>
							<div className='flex gap-2 items-end'>
								<div className='flex-1 space-y-1'>
									<label className='text-xs text-slate-500 dark:text-slate-400'>Skill Name</label>
									<input
										type='text'
										value={newSkillName}
										onChange={(e) => setNewSkillName(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
										className='w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'
										placeholder='e.g. React'
									/>
								</div>
								<div className='w-1/3 space-y-1'>
									<label className='text-xs text-slate-500 dark:text-slate-400'>Level</label>
									<select
										value={newSkillLevel}
										onChange={(e) => setNewSkillLevel(e.target.value as SkillLevel)}
										className='w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3 text-sm text-slate-900 dark:text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 appearance-none'>
										<option value='basic'>Basic</option>
										<option value='intermediate'>Intermediate</option>
										<option value='senior'>Senior</option>
									</select>
								</div>
								<button
									type='button'
									onClick={handleAddSkill}
									className='rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-2 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'>
									<Plus className='h-5 w-5' />
								</button>
							</div>

							<div className='flex flex-wrap gap-2 min-h-[40px]'>
								{skills.map((skill, index) => (
									<div
										key={index}
										className='inline-flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5'>
										<span className='text-sm font-medium text-slate-700 dark:text-slate-200'>{skill.name}</span>
										<span
											className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
												skill.level === 'senior'
													? 'bg-purple-500/10 text-purple-400'
													: skill.level === 'intermediate'
													? 'bg-blue-500/10 text-blue-400'
													: 'bg-green-500/10 text-green-400'
											}`}>
											{skill.level}
										</span>
										<button
											type='button'
											onClick={() => removeSkill(index)}
											className='ml-1 text-slate-500 hover:text-red-400'>
											<X className='h-3 w-3' />
										</button>
									</div>
								))}
								{skills.length === 0 && (
									<span className='text-sm text-slate-500 italic py-1'>No skills added yet.</span>
								)}
							</div>
						</div>
					</div>

					<div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
						{/* Interview Types */}
						<div className='space-y-4'>
							<h4 className='text-sm font-semibold text-orange-600 dark:text-orange-500 uppercase tracking-wider flex items-center gap-2'>
								<FileText className='h-4 w-4' /> Interview Rounds
							</h4>
							<div className='grid grid-cols-1 gap-2'>
								{INTERVIEW_TYPES_OPTIONS.map((type) => (
									<label
										key={type}
										className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-all ${
											selectedInterviewTypes.includes(type)
												? 'border-orange-500 bg-orange-500/10 text-slate-900 dark:text-white'
												: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
										}`}>
										<span className='capitalize font-medium'>{type.replace('_', ' ')}</span>
										<input
											type='checkbox'
											className='sr-only'
											checked={selectedInterviewTypes.includes(type)}
											onChange={() => toggleInterviewType(type)}
										/>
										{selectedInterviewTypes.includes(type) && <CheckCircle className='h-4 w-4 text-orange-500' />}
									</label>
								))}
							</div>
						</div>

						{/* Evaluation Weights */}
						<div className='space-y-4'>
							<h4 className='text-sm font-semibold text-orange-600 dark:text-orange-500 uppercase tracking-wider flex items-center gap-2'>
								<Sliders className='h-4 w-4' /> Weights
							</h4>
							<div className='space-y-5 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50'>
								{(Object.keys(weights) as Array<keyof EvaluationWeights>).map((key) => (
									<div
										key={key}
										className='space-y-2'>
										<div className='flex justify-between text-sm'>
											<span className='capitalize text-slate-600 dark:text-slate-300'>{key.replace('_', ' ')}</span>
											<span className='font-mono font-bold text-orange-600 dark:text-orange-400'>{weights[key]}</span>
										</div>
										<input
											type='range'
											min='0'
											max='1'
											step='0.1'
											value={weights[key]}
											onChange={(e) => handleWeightChange(key, parseFloat(e.target.value))}
											className='h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-slate-700 accent-orange-600 dark:accent-orange-500'
										/>
									</div>
								))}
								<div className='pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center'>
									<span className='text-xs text-slate-500 dark:text-slate-400'>Total Weight</span>
									<span
										className={`text-sm font-bold ${
											Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 1.0) < 0.01
												? 'text-emerald-600 dark:text-emerald-400'
												: 'text-red-600 dark:text-red-400'
										}`}>
										{Object.values(weights)
											.reduce((a, b) => a + b, 0)
											.toFixed(1)}
									</span>
								</div>
							</div>
						</div>
					</div>
				</form>

				<div className='shrink-0 border-t border-slate-200 dark:border-slate-800 p-6 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900'>
					<button
						type='button'
						onClick={onClose}
						className='rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors'>
						Cancel
					</button>
					<button
						onClick={handleSubmit}
						className='rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600'>
						{initialData ? 'Update Position' : 'Create Position'}
					</button>
				</div>
			</div>
		</div>
	);
}
