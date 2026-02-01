'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { User, Mail, Calendar, MapPin, Loader2, Save, Globe, Building2 } from 'lucide-react';

interface UserProfile {
	id: string;
	full_name: string;
	email: string;
	role: string;
	gender: string;
	date_of_birth: string;
	organization_name?: string;
	organization_domain?: string;
	organization_id?: string;
	organization_city?: string;
	organization_country?: string;
}

import { toast } from 'sonner';

export default function ProfileSettings() {
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		fetchProfile();
	}, []);

	const fetchProfile = async () => {
		try {
			const res = await api.get('/users/me');
			const userData = res.data;

			// Prepopulate Org Details from email if missing (and not common provider)
			if (!userData.organization_name && userData.email) {
				const domain = userData.email.split('@')[1];
				const commonProviders = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
				if (domain && !commonProviders.includes(domain)) {
					userData.organization_domain = domain;
					// Capitalize first letter of domain name for Name
					const name = domain.split('.')[0];
					userData.organization_name = name.charAt(0).toUpperCase() + name.slice(1);
				}
			}

			setProfile(userData);
		} catch (err) {
			console.error('Failed to fetch profile:', err);
			toast.error('Failed to load profile data');
		} finally {
			setIsLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!profile) return;
		setIsSaving(true);

		const updatePromise = (async () => {
			await api.put('/users/me', {
				fullName: profile.full_name,
				gender: profile.gender,
				dob: profile.date_of_birth,
			});

			if (profile.role === 'admin' && profile.organization_id) {
				await api.put(`/organizations/${profile.organization_id}`, {
					name: profile.organization_name,
					domain: profile.organization_domain,
					city: profile.organization_city,
					country: profile.organization_country,
				});
			}
		})();

		toast.promise(updatePromise, {
			loading: 'Saving profile changes...',
			success: 'Profile updated successfully',
			error: (err: any) => err.response?.data?.error || 'Failed to update profile',
			finally: () => setIsSaving(false),
		});
	};

	if (isLoading) {
		return (
			<div className='p-12 flex justify-center'>
				<Loader2 className='h-8 w-8 animate-spin text-orange-500' />
			</div>
		);
	}

	if (!profile) return null;

	return (
		<div className='p-6 sm:p-8'>
			<div className='mb-6 flex items-center gap-3'>
				<div className='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20'>
					<User className='h-5 w-5' />
				</div>
				<div>
					<h2 className='text-lg font-semibold text-white'>Public Profile</h2>
					<p className='text-xs text-slate-400'>Update your personal information.</p>
				</div>
			</div>

			<form
				onSubmit={handleSubmit}
				className='space-y-6 max-w-2xl'>
				<div className='grid grid-cols-1 gap-6 sm:grid-cols-2'>
					<div className='sm:col-span-2'>
						<label className='block text-sm font-medium text-slate-300 mb-1'>Full Name</label>
						<div className='relative'>
							<User className='absolute left-3 top-2.5 h-4 w-4 text-slate-500' />
							<input
								type='text'
								value={profile.full_name || ''}
								onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
								className='w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'
							/>
						</div>
					</div>

					<div className='sm:col-span-2'>
						<label className='block text-sm font-medium text-slate-300 mb-1'>Email Address</label>
						<div className='relative'>
							<Mail className='absolute left-3 top-2.5 h-4 w-4 text-slate-500' />
							<input
								type='email'
								disabled
								value={profile.email || ''}
								className='w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 pl-10 pr-4 text-sm text-slate-400 cursor-not-allowed'
							/>
						</div>
						<p className='mt-1 text-xs text-slate-500'>Email cannot be changed.</p>
					</div>

					<div>
						<label className='block text-sm font-medium text-slate-300 mb-1'>Gender</label>
						<div className='relative'>
							<select
								value={profile.gender || ''}
								onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
								className='w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-3 pr-10 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 appearance-none'>
								<option value=''>Select Gender</option>
								<option value='male'>Male</option>
								<option value='female'>Female</option>
								<option value='non_binary'>Non-Binary</option>
								<option value='prefer_not_to_say'>Prefer not to say</option>
							</select>
						</div>
					</div>

					<div>
						<label className='block text-sm font-medium text-slate-300 mb-1'>Date of Birth</label>
						<div className='relative'>
							<Calendar className='absolute left-3 top-2.5 h-4 w-4 text-slate-500' />
							<input
								type='date'
								value={profile.date_of_birth ? new Date(profile.date_of_birth).toISOString().split('T')[0] : ''}
								onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
								className='w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500'
							/>
						</div>
					</div>
				</div>

				{/* Organization Details */}
				<div className='sm:col-span-2 pt-6 border-t border-slate-800 mt-2'>
					<div className='flex items-center gap-2 mb-4'>
						<Building2 className='h-5 w-5 text-orange-500' />
						<h3 className='text-base font-semibold text-white'>Organization Details</h3>
					</div>
					<div className='grid grid-cols-1 gap-6 sm:grid-cols-2'>
						<div>
							<label className='block text-sm font-medium text-slate-300 mb-1'>Organization Name</label>
							<input
								type='text'
								disabled={profile.role !== 'admin'}
								value={profile.organization_name || ''}
								onChange={(e) => setProfile({ ...profile, organization_name: e.target.value })}
								className={`w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 px-4 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 ${
									profile.role !== 'admin' ? 'text-slate-400 cursor-not-allowed' : 'text-white'
								}`}
							/>
						</div>
						<div>
							<label className='block text-sm font-medium text-slate-300 mb-1'>Domain</label>
							<input
								type='text'
								disabled={profile.role !== 'admin'}
								value={profile.organization_domain || ''}
								onChange={(e) => setProfile({ ...profile, organization_domain: e.target.value })}
								className={`w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 px-4 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 ${
									profile.role !== 'admin' ? 'text-slate-400 cursor-not-allowed' : 'text-white'
								}`}
							/>
						</div>
						<div>
							<label className='block text-sm font-medium text-slate-300 mb-1'>City</label>
							<input
								type='text'
								disabled={profile.role !== 'admin'}
								value={profile.organization_city || ''}
								onChange={(e) => setProfile({ ...profile, organization_city: e.target.value })}
								className={`w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 px-4 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 ${
									profile.role !== 'admin' ? 'text-slate-400 cursor-not-allowed' : 'text-white'
								}`}
							/>
						</div>
						<div>
							<label className='block text-sm font-medium text-slate-300 mb-1'>Country</label>
							<input
								type='text'
								disabled={profile.role !== 'admin'}
								value={profile.organization_country || ''}
								onChange={(e) => setProfile({ ...profile, organization_country: e.target.value })}
								className={`w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 px-4 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 ${
									profile.role !== 'admin' ? 'text-slate-400 cursor-not-allowed' : 'text-white'
								}`}
							/>
						</div>
					</div>
				</div>

				<div className='pt-4 border-t border-slate-800'>
					<button
						type='submit'
						disabled={isSaving}
						className='flex items-center gap-2 rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all'>
						{isSaving ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
						Save Profile
					</button>
				</div>
			</form>
		</div>
	);
}
