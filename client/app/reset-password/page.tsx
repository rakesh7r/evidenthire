'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Lock, Loader2, KeyRound } from 'lucide-react';
import Link from 'next/link';

export default function ResetPassword() {
	const router = useRouter();
	const supabase = createClient();
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setMessage(null);

		if (password !== confirmPassword) {
			setError('Passwords do not match');
			return;
		}

		if (password.length < 6) {
			setError('Password must be at least 6 characters');
			return;
		}

		setIsLoading(true);

		try {
			const { error } = await supabase.auth.updateUser({
				password: password,
			});

			if (error) {
				throw error;
			}

			setMessage('Password updated successfully! Redirecting to login...');
			setTimeout(() => {
				router.push('/login');
			}, 2000);
		} catch (err: any) {
			setError(err.message || 'Failed to update password');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className='flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8'>
			{/* Background Effects */}
			<div className='absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none' />

			<div className='relative w-full max-w-md space-y-8 z-10'>
				<div className='flex flex-col items-center'>
					<div className='flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-500/20'>
						<Lock className='h-6 w-6 text-white' />
					</div>
					<h2 className='mt-6 text-center text-3xl font-bold tracking-tight text-white'>Set new password</h2>
					<p className='mt-2 text-center text-sm text-slate-400'>Please enter a new password for your account.</p>
				</div>

				<div className='mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl p-8 shadow-xl'>
					<form
						className='space-y-6'
						onSubmit={handleSubmit}>
						{error && (
							<div className='rounded-md bg-red-500/10 p-4 text-sm text-red-500 border border-red-500/20'>{error}</div>
						)}
						{message && (
							<div className='rounded-md bg-green-500/10 p-4 text-sm text-green-500 border border-green-500/20'>
								{message}
							</div>
						)}

						<div>
							<label
								htmlFor='password'
								className='block text-sm font-medium text-slate-300'>
								New Password
							</label>
							<div className='relative mt-1'>
								<KeyRound className='absolute left-3 top-2.5 h-4 w-4 text-slate-500' />
								<input
									id='password'
									name='password'
									type='password'
									required
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className='block w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 pl-10 pr-3 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm transition-all'
									placeholder='••••••••'
								/>
							</div>
						</div>

						<div>
							<label
								htmlFor='confirmPassword'
								className='block text-sm font-medium text-slate-300'>
								Confirm Password
							</label>
							<div className='relative mt-1'>
								<KeyRound className='absolute left-3 top-2.5 h-4 w-4 text-slate-500' />
								<input
									id='confirmPassword'
									name='confirmPassword'
									type='password'
									required
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									className='block w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 pl-10 pr-3 text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm transition-all'
									placeholder='••••••••'
								/>
							</div>
						</div>

						<button
							type='submit'
							disabled={isLoading}
							className='flex w-full justify-center rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed'>
							{isLoading ? <Loader2 className='h-5 w-5 animate-spin' /> : 'Update Password'}
						</button>

						<div className='text-center mt-4'>
							<Link
								href='/dashboard'
								className='text-sm text-slate-500 hover:text-slate-300 transition-colors'>
								Skip to Dashboard
							</Link>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
