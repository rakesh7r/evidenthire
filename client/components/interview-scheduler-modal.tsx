'use client';

import { X, Calendar, Clock, Video, User } from 'lucide-react';
import { useState } from 'react';

interface SchedulerModalProps {
	candidateName: string;
	onClose: () => void;
}

export default function SchedulerModal({ candidateName, onClose }: SchedulerModalProps) {
	const [selectedDate, setSelectedDate] = useState<string>('');
	const [selectedTime, setSelectedTime] = useState<string>('');

	const dates = [
		{ day: 'Mon', date: '12' },
		{ day: 'Tue', date: '13' },
		{ day: 'Wed', date: '14' },
		{ day: 'Thu', date: '15' },
		{ day: 'Fri', date: '16' },
	];

	const times = ['09:00 AM', '10:30 AM', '01:00 PM', '03:30 PM', '05:00 PM'];

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
			<div className='w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200'>
				<div className='relative border-b border-slate-200 dark:border-slate-800 p-6'>
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

				<div className='p-6 space-y-6'>
					<div>
						<label className='mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300'>Select Date</label>
						<div className='flex justify-between gap-2 overflow-x-auto pb-2'>
							{dates.map((d, i) => (
								<button
									key={i}
									onClick={() => setSelectedDate(d.date)}
									className={`flex flex-col items-center justify-center min-w-14 rounded-xl border p-3 transition-all ${
										selectedDate === d.date
											? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500'
											: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-orange-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
									}`}>
									<span className='text-xs font-medium uppercase'>{d.day}</span>
									<span className='text-lg font-bold'>{d.date}</span>
								</button>
							))}
						</div>
					</div>

					<div>
						<label className='mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300'>Select Time</label>
						<div className='grid grid-cols-2 gap-3'>
							{times.map((t) => (
								<button
									key={t}
									onClick={() => setSelectedTime(t)}
									className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
										selectedTime === t
											? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500'
											: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-orange-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
									}`}>
									<Clock className='h-4 w-4' />
									{t}
								</button>
							))}
						</div>
					</div>

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

				<div className='border-t border-slate-200 dark:border-slate-800 p-6 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900'>
					<button
						onClick={onClose}
						className='rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors'>
						Cancel
					</button>
					<button
						disabled={!selectedDate || !selectedTime}
						onClick={() => {
							// Just mock success for now
							alert('Interview Scheduled!');
							onClose();
						}}
						className='rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all'>
						Confirm Schedule
					</button>
				</div>
			</div>
		</div>
	);
}
