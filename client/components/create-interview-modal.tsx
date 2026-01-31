'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { X, User, Briefcase, Calendar, Clock, Mail, Users, Check, Search, Plus } from 'lucide-react';
import { UserRole, Position } from '@/types/db';

export interface SimpleUser {
	id: string;
	name: string;
	email: string;
}

interface CreateInterviewModalProps {
	onClose: () => void;
	onSubmit: (data: any) => void;
	positions: Position[];
	userRole: UserRole;
	availableUsers: SimpleUser[];
}

export default function CreateInterviewModal({
	onClose,
	onSubmit,
	positions,
	userRole,
	availableUsers,
}: CreateInterviewModalProps) {
	const [candidateName, setCandidateName] = useState('');
	const [candidateEmail, setCandidateEmail] = useState('');
	const [selectedPositionId, setSelectedPositionId] = useState('');
	const [date, setDate] = useState('');
	const [time, setTime] = useState('');

	// Interviewer Selection State
	const [selectedInterviewerIds, setSelectedInterviewerIds] = useState<string[]>([]);
	const [interviewerSearchTerm, setInterviewerSearchTerm] = useState('');
	const [isInterviewerDropdownOpen, setIsInterviewerDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const canCreate = ['admin', 'recruiter'].includes(userRole);

	const minDate = new Date().toISOString().split('T')[0];

	const isTimeValid = useMemo(() => {
		if (!date || !time) return true;
		const selectedDateTime = new Date(`${date}T${time}`);
		return selectedDateTime > new Date();
	}, [date, time]);

	// Close dropdown when clicking outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsInterviewerDropdownOpen(false);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const filteredUsers = useMemo(() => {
		return availableUsers.filter(
			(user) =>
				!selectedInterviewerIds.includes(user.id) &&
				(user.name.toLowerCase().includes(interviewerSearchTerm.toLowerCase()) ||
					user.email.toLowerCase().includes(interviewerSearchTerm.toLowerCase()))
		);
	}, [availableUsers, selectedInterviewerIds, interviewerSearchTerm]);

	const handleAddInterviewer = (userId: string) => {
		setSelectedInterviewerIds([...selectedInterviewerIds, userId]);
		setInterviewerSearchTerm('');
	};

	const handleRemoveInterviewer = (userId: string) => {
		setSelectedInterviewerIds(selectedInterviewerIds.filter((id) => id !== userId));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!canCreate) return;
		if (!isTimeValid) {
			alert('Please select a future date and time.');
			return;
		}
		onSubmit({
			candidateName,
			candidateEmail,
			positionId: selectedPositionId,
			date,
			time,
			interviewerIds: selectedInterviewerIds,
		});
		onClose();
	};

	if (!canCreate) {
		return (
			<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
				<div className='w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6'>
					<h3 className='text-lg font-semibold text-red-500'>Permission Denied</h3>
					<p className='mt-2 text-slate-400'>Only Administrators and Recruiters can create interviews.</p>
					<div className='mt-6 flex justify-end'>
						<button
							onClick={onClose}
							className='rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700'>
							Close
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
			<div className='w-full max-w-lg overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]'>
				<div className='relative border-b border-slate-800 p-6 flex-shrink-0'>
					<h3 className='text-xl font-semibold text-white'>Schedule Interview</h3>
					<p className='mt-1 text-sm text-slate-400'>Set up a new interview with a candidate.</p>
					<button
						onClick={onClose}
						className='absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors'>
						<X className='h-5 w-5' />
					</button>
				</div>

				<form
					onSubmit={handleSubmit}
					className='p-6 space-y-6 overflow-y-auto'>
					{/* Candidate Details */}
					<div className='space-y-4'>
						<h4 className='text-sm font-semibold text-orange-500 uppercase tracking-wider flex items-center gap-2'>
							<User className='h-4 w-4' /> Candidate
						</h4>
						<div className='grid grid-cols-1 gap-4'>
							<div className='space-y-2'>
								<label className='text-sm font-medium text-slate-300'>Full Name</label>
								<input
									type='text'
									required
									value={candidateName}
									onChange={(e) => setCandidateName(e.target.value)}
									className='w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'
									placeholder='Jane Doe'
								/>
							</div>
							<div className='space-y-2'>
								<label className='text-sm font-medium text-slate-300'>Email Address</label>
								<div className='relative'>
									<Mail className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500' />
									<input
										type='email'
										required
										value={candidateEmail}
										onChange={(e) => setCandidateEmail(e.target.value)}
										className='w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'
										placeholder='jane@example.com'
									/>
								</div>
							</div>
						</div>
					</div>

					{/* Position Details */}
					<div className='space-y-4'>
						<h4 className='text-sm font-semibold text-orange-500 uppercase tracking-wider flex items-center gap-2'>
							<Briefcase className='h-4 w-4' /> Position
						</h4>
						<div className='space-y-2'>
							<label className='text-sm font-medium text-slate-300'>Target Role</label>
							<select
								required
								value={selectedPositionId}
								onChange={(e) => setSelectedPositionId(e.target.value)}
								className='w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 px-3 text-sm text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 appearance-none'>
								<option
									value=''
									disabled>
									Select a position...
								</option>
								{positions.map((pos) => (
									<option
										key={pos.id}
										value={pos.id}>
										{pos.title}
									</option>
								))}
							</select>
						</div>
					</div>

					{/* Schedule Details */}
					<div className='space-y-4'>
						<h4 className='text-sm font-semibold text-orange-500 uppercase tracking-wider flex items-center gap-2'>
							<Calendar className='h-4 w-4' /> Schedule
						</h4>
						<div className='grid grid-cols-2 gap-4'>
							<div className='space-y-2'>
								<label className='text-sm font-medium text-slate-300'>Date</label>
								<input
									type='date'
									required
									min={minDate}
									value={date}
									onChange={(e) => setDate(e.target.value)}
									className='w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 px-3 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 [color-scheme:dark]'
								/>
							</div>
							<div className='space-y-2'>
								<label className='text-sm font-medium text-slate-300'>Time</label>
								<div className='relative'>
									<Clock className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500' />
									<input
										type='time'
										required
										value={time}
										onChange={(e) => setTime(e.target.value)}
										className={`w-full rounded-lg border ${
											!isTimeValid && date && time
												? 'border-red-500 focus:border-red-500 focus:ring-red-500'
												: 'border-slate-700 focus:border-orange-500 focus:ring-orange-500'
										} bg-slate-800 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 [color-scheme:dark]`}
									/>
								</div>
							</div>
						</div>
						{!isTimeValid && date && time && <p className='text-xs text-red-500 mt-1'>Please select a future time.</p>}
					</div>

					{/* Interviewers - Autocomplete */}
					<div className='space-y-4'>
						<h4 className='text-sm font-semibold text-orange-500 uppercase tracking-wider flex items-center gap-2'>
							<Users className='h-4 w-4' /> Interviewers
						</h4>
						<div className='space-y-3'>
							<label className='text-sm font-medium text-slate-300'>Assign Team Members</label>

							{/* Selected Chips */}
							{selectedInterviewerIds.length > 0 && (
								<div className='flex flex-wrap gap-2 mb-2'>
									{selectedInterviewerIds.map((id) => {
										const user = availableUsers.find((u) => u.id === id);
										return (
											<div
												key={id}
												className='inline-flex items-center gap-1.5 rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs text-slate-200'>
												<div className='bg-orange-500/20 text-orange-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold'>
													{user?.name.charAt(0)}
												</div>
												{user?.name}
												<button
													type='button'
													onClick={() => handleRemoveInterviewer(id)}
													className='ml-1 text-slate-500 hover:text-red-400 focus:outline-none'>
													<X className='h-3 w-3' />
												</button>
											</div>
										);
									})}
								</div>
							)}

							<div
								className='relative'
								ref={dropdownRef}>
								<Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500' />
								<input
									type='text'
									value={interviewerSearchTerm}
									onChange={(e) => {
										setInterviewerSearchTerm(e.target.value);
										setIsInterviewerDropdownOpen(true);
									}}
									onFocus={() => setIsInterviewerDropdownOpen(true)}
									className='w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'
									placeholder='Search by name or email...'
								/>

								{/* Dropdown List */}
								{isInterviewerDropdownOpen && (
									<div className='absolute z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 shadow-xl max-h-60 overflow-auto'>
										{filteredUsers.length === 0 ? (
											<div className='p-3 text-sm text-slate-500 text-center'>No users found</div>
										) : (
											<div className='py-1'>
												{filteredUsers.map((user) => (
													<button
														key={user.id}
														type='button'
														onClick={() => handleAddInterviewer(user.id)}
														className='w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-700 transition-colors text-left'>
														<div className='flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-slate-300 text-xs font-semibold'>
															{user.name.charAt(0)}
														</div>
														<div>
															<div className='text-sm font-medium text-white'>{user.name}</div>
															<div className='text-xs text-slate-400'>{user.email}</div>
														</div>
														<div className='ml-auto opacity-0 group-hover:opacity-100'>
															<Plus className='h-4 w-4 text-orange-500' />
														</div>
													</button>
												))}
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					</div>

					<div className='flex-shrink-0 border-t border-slate-800 p-6 flex justify-end gap-3 bg-slate-900'>
						<button
							type='button'
							onClick={onClose}
							className='rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors'>
							Cancel
						</button>
						<button
							onClick={handleSubmit}
							className='rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600'>
							Schedule Interview
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
