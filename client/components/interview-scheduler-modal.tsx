'use client';

import {
	X,
	Calendar,
	Clock,
	Video,
	User,
	Users,
	Loader2,
	CheckCircle,
	Search,
	ChevronDown,
	ListFilter,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Round } from '@/types/db';

interface TeamMember {
	id: string;
	email: string;
	full_name: string | null;
	role: string;
}

interface SchedulerModalProps {
	candidateName: string;
	candidateEmail: string;
	positionId: string;
	rounds?: (string | Round)[];
	defaultRound?: string;
	onClose: () => void;
	onSuccess?: () => void;
}

export default function SchedulerModal({
	candidateName,
	candidateEmail,
	positionId,
	rounds = [],
	defaultRound,
	onClose,
	onSuccess,
}: SchedulerModalProps) {
	const [selectedDate, setSelectedDate] = useState<string>('');
	const [selectedTime, setSelectedTime] = useState<string>('');

	// Helper to get initial selected round
	const getInitialRound = () => {
		if (defaultRound) {
			const found = rounds.find((r) => (typeof r === 'string' ? r === defaultRound : r.title === defaultRound));
			if (found) return typeof found === 'string' ? found : found.title;
		}
		if (rounds.length > 0) {
			const first = rounds[0];
			return typeof first === 'string' ? first : first.title;
		}
		return '';
	};

	const [selectedRound, setSelectedRound] = useState<string>(getInitialRound());
	const [selectedInterviewers, setSelectedInterviewers] = useState<TeamMember[]>([]);
	const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
	const [loading, setLoading] = useState(false);
	const [loadingTeam, setLoadingTeam] = useState(true);
	const [isSuccess, setIsSuccess] = useState(false);

	// Dropdown state
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const dropdownRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Fetch team members
	useEffect(() => {
		const fetchTeam = async () => {
			try {
				const { data } = await api.get('/users/team');
				setTeamMembers(data || []);
			} catch (err) {
				console.error('Failed to fetch team:', err);
				toast.error('Failed to load team members');
			} finally {
				setLoadingTeam(false);
			}
		};
		fetchTeam();
	}, []);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	// Filter team members based on search query
	const filteredMembers = teamMembers.filter((member) => {
		const searchLower = searchQuery.toLowerCase();
		const name = member.full_name?.toLowerCase() || '';
		const email = member.email.toLowerCase();
		const isNotSelected = !selectedInterviewers.some((s) => s.id === member.id);
		return isNotSelected && (name.includes(searchLower) || email.includes(searchLower));
	});

	// Get minimum date (today)
	const today = new Date().toISOString().split('T')[0];

	const addInterviewer = (member: TeamMember) => {
		setSelectedInterviewers((prev) => [...prev, member]);
		setSearchQuery('');
		setIsDropdownOpen(false);
	};

	const removeInterviewer = (id: string) => {
		setSelectedInterviewers((prev) => prev.filter((m) => m.id !== id));
	};

	const handleSubmit = async () => {
		if (!selectedDate || !selectedTime) {
			toast.error('Please select date and time');
			return;
		}

		if (selectedInterviewers.length === 0) {
			toast.error('Please select at least one interviewer');
			return;
		}

		if (!selectedRound) {
			toast.error('Please select an interview round');
			return;
		}

		setLoading(true);

		// Find the actual round object if possible
		const roundObj = rounds.find((r) => (typeof r === 'string' ? r === selectedRound : r.title === selectedRound));
		const roundTitle = typeof roundObj === 'string' ? roundObj : roundObj?.title;
		const roundType = typeof roundObj === 'string' ? roundObj : roundObj?.type;

		try {
			await api.post('/interviews', {
				candidateName,
				candidateEmail,
				positionId,
				date: selectedDate,
				time: selectedTime,
				roundTitle,
				roundType,
				interviewerIds: selectedInterviewers.map((m) => m.id),
			});

			setIsSuccess(true);
			toast.success('Interview scheduled successfully!', {
				description: `An invitation has been sent to ${candidateEmail}`,
			});

			setTimeout(() => {
				onSuccess?.();
				onClose();
			}, 1500);
		} catch (err: any) {
			console.error('Failed to schedule interview:', err);
			toast.error('Failed to schedule interview', {
				description: err.response?.data?.error || 'Please try again',
			});
		} finally {
			setLoading(false);
		}
	};

	if (isSuccess) {
		return (
			<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
				<div className='w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200 p-8'>
					<div className='flex flex-col items-center text-center'>
						<div className='flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mb-4'>
							<CheckCircle className='h-8 w-8 text-emerald-500' />
						</div>
						<h3 className='text-xl font-semibold text-slate-900 dark:text-white mb-2'>Interview Scheduled!</h3>
						<p className='text-sm text-slate-500'>An invitation has been sent to {candidateEmail}</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
			<div className='w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col'>
				{/* Header */}
				<div className='relative border-b border-slate-200 dark:border-slate-800 p-6 shrink-0'>
					<h3 className='text-xl font-semibold text-slate-900 dark:text-white'>Schedule Interview</h3>
					<div className='mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400'>
						<User className='h-3 w-3' />
						Candidate: <span className='font-medium text-slate-700 dark:text-slate-300'>{candidateName}</span>
					</div>
					<button
						onClick={onClose}
						className='absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors'>
						<X className='h-5 w-5' />
					</button>
				</div>

				{/* Scrollable Content */}
				<div className='flex-1 overflow-y-auto p-6 space-y-6'>
					{/* Round Selection */}
					<div>
						<label className='mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300'>
							<ListFilter className='inline h-4 w-4 mr-1.5' />
							Select Round
						</label>
						{rounds.length > 0 ? (
							<select
								value={selectedRound}
								onChange={(e) => setSelectedRound(e.target.value)}
								className='w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all'>
								{rounds.map((round, idx) => {
									const title = typeof round === 'string' ? round : round.title;
									const value = typeof round === 'string' ? round : round.title;
									return (
										<option
											key={idx}
											value={value}>
											{title.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
										</option>
									);
								})}
							</select>
						) : (
							<input
								type='text'
								value={selectedRound}
								onChange={(e) => setSelectedRound(e.target.value)}
								placeholder='e.g. Technical Screening'
								className='w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all'
							/>
						)}
					</div>

					{/* Date & Time Picker */}
					<div className='grid grid-cols-2 gap-4'>
						<div>
							<label className='mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300'>
								<Calendar className='inline h-4 w-4 mr-1.5' />
								Date
							</label>
							<input
								type='date'
								min={today}
								value={selectedDate}
								onChange={(e) => setSelectedDate(e.target.value)}
								className='w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all'
							/>
						</div>
						<div>
							<label className='mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300'>
								<Clock className='inline h-4 w-4 mr-1.5' />
								Time
							</label>
							<input
								type='time'
								value={selectedTime}
								onChange={(e) => setSelectedTime(e.target.value)}
								className='w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all'
							/>
						</div>
					</div>

					{/* Searchable Interviewers Dropdown */}
					<div>
						<label className='mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300'>
							<Users className='inline h-4 w-4 mr-1.5' />
							Add Interviewers
						</label>

						{/* Selected Interviewers Tags */}
						{selectedInterviewers.length > 0 && (
							<div className='flex flex-wrap gap-2 mb-3'>
								{selectedInterviewers.map((member) => (
									<div
										key={member.id}
										className='flex items-center gap-2 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 px-3 py-1.5 rounded-full text-sm font-medium border border-orange-200 dark:border-orange-500/20'>
										<span>{member.full_name || member.email}</span>
										<button
											type='button'
											onClick={() => removeInterviewer(member.id)}
											className='hover:bg-orange-200 dark:hover:bg-orange-500/20 rounded-full p-0.5 transition-colors'>
											<X className='h-3.5 w-3.5' />
										</button>
									</div>
								))}
							</div>
						)}

						{/* Searchable Dropdown */}
						<div
							ref={dropdownRef}
							className='relative'>
							<div
								className={`flex items-center gap-2 w-full rounded-xl border bg-white dark:bg-slate-800 px-4 py-3 transition-all cursor-text ${
									isDropdownOpen
										? 'border-orange-500 ring-2 ring-orange-500/20'
										: 'border-slate-200 dark:border-slate-700'
								}`}
								onClick={() => {
									setIsDropdownOpen(true);
									inputRef.current?.focus();
								}}>
								<Search className='h-4 w-4 text-slate-400' />
								<input
									ref={inputRef}
									type='text'
									value={searchQuery}
									onChange={(e) => {
										setSearchQuery(e.target.value);
										setIsDropdownOpen(true);
									}}
									onFocus={() => setIsDropdownOpen(true)}
									placeholder='Search team members...'
									className='flex-1 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none text-sm'
								/>
								<ChevronDown
									className={`h-4 w-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
								/>
							</div>

							{/* Dropdown Menu */}
							{isDropdownOpen && (
								<div className='absolute z-10 top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200'>
									{loadingTeam ? (
										<div className='flex items-center justify-center py-4'>
											<Loader2 className='h-5 w-5 animate-spin text-orange-500' />
										</div>
									) : filteredMembers.length === 0 ? (
										<div className='px-4 py-3 text-sm text-slate-500 text-center'>
											{searchQuery ? 'No matching team members' : 'All team members selected'}
										</div>
									) : (
										filteredMembers.map((member) => (
											<button
												key={member.id}
												type='button'
												onClick={() => addInterviewer(member)}
												className='w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left border-b border-slate-100 dark:border-slate-700/50 last:border-b-0'>
												<div className='flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300'>
													{(member.full_name || member.email)[0].toUpperCase()}
												</div>
												<div className='flex-1 min-w-0'>
													<div className='text-sm font-medium text-slate-900 dark:text-white truncate'>
														{member.full_name || member.email}
													</div>
													<div className='text-xs text-slate-500 truncate'>{member.email}</div>
												</div>
											</button>
										))
									)}
								</div>
							)}
						</div>

						{selectedInterviewers.length > 0 && (
							<p className='text-xs text-slate-500 mt-2'>
								{selectedInterviewers.length} interviewer{selectedInterviewers.length > 1 ? 's' : ''} selected
							</p>
						)}
					</div>

					{/* Video Interview Info */}
					<div className='rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700/50'>
						<div className='flex items-center gap-3'>
							<div className='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10'>
								<Video className='h-5 w-5 text-blue-500' />
							</div>
							<div>
								<div className='font-medium text-slate-900 dark:text-white'>EvidentHire Video Interview</div>
								<div className='text-xs text-slate-500'>A meeting link will be generated automatically</div>
							</div>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className='border-t border-slate-200 dark:border-slate-800 p-6 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900 shrink-0'>
					<button
						onClick={onClose}
						disabled={loading}
						className='rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50'>
						Cancel
					</button>
					<button
						disabled={!selectedDate || !selectedTime || !selectedRound || selectedInterviewers.length === 0 || loading}
						onClick={handleSubmit}
						className='flex items-center gap-2 rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all'>
						{loading ? (
							<>
								<Loader2 className='h-4 w-4 animate-spin' />
								Scheduling...
							</>
						) : (
							'Confirm Schedule'
						)}
					</button>
				</div>
			</div>
		</div>
	);
}
