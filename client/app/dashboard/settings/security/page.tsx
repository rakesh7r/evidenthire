'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { KeyRound, Loader2, Save, ShieldCheck } from 'lucide-react';

export default function SecuritySettings() {
	const supabase = createClient();
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	const handleUpdatePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage(null);

		if (newPassword !== confirmPassword) {
			setMessage({ type: 'error', text: 'Passwords do not match' });
			return;
		}

		if (newPassword.length < 6) {
			setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
			return;
		}

		setIsLoading(true);

		try {
			const { error } = await supabase.auth.updateUser({
				password: newPassword,
			});

			if (error) throw error;

			setMessage({ type: 'success', text: 'Password updated successfully' });
			setNewPassword('');
			setConfirmPassword('');
		} catch (err: any) {
			setMessage({ type: 'error', text: err.message || 'Failed to update password' });
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className='p-6 sm:p-8'>
			<div className='mb-6 flex items-center gap-3'>
				<div className='flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20'>
					<ShieldCheck className='h-5 w-5' />
				</div>
				<div>
					<h2 className='text-lg font-semibold text-white'>Update Password</h2>
					<p className='text-xs text-slate-400'>Ensure your account uses a strong, unique password.</p>
				</div>
			</div>

			<form
				onSubmit={handleUpdatePassword}
				className='space-y-5 max-w-md'>
				{message && (
					<div
						className={`rounded-lg p-3 text-sm ${
							message.type === 'success'
								? 'bg-green-500/10 text-green-500 border border-green-500/20'
								: 'bg-red-500/10 text-red-500 border border-red-500/20'
						}`}>
						{message.text}
					</div>
				)}

				<div className='space-y-4'>
					<div>
						<label
							htmlFor='new-password'
							className='block text-sm font-medium text-slate-300 mb-1'>
							New Password
						</label>
						<div className='relative'>
							<KeyRound className='absolute left-3 top-2.5 h-4 w-4 text-slate-500' />
							<input
								id='new-password'
								type='password'
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								className='w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors'
								placeholder='••••••••'
							/>
						</div>
					</div>

					<div>
						<label
							htmlFor='confirm-password'
							className='block text-sm font-medium text-slate-300 mb-1'>
							Confirm New Password
						</label>
						<div className='relative'>
							<KeyRound className='absolute left-3 top-2.5 h-4 w-4 text-slate-500' />
							<input
								id='confirm-password'
								type='password'
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								className='w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors'
								placeholder='••••••••'
							/>
						</div>
					</div>
				</div>

				<div className='pt-2'>
					<button
						type='submit'
						disabled={isLoading}
						className='flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all'>
						{isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
						Save Changes
					</button>
				</div>
			</form>
		</div>
	);
}
