'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
	User,
	Building2,
	Globe,
	Mail,
	Calendar,
	MapPin,
	Flag,
	ChevronRight,
	Loader2,
	CheckCircle2,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function OnboardingPage() {
	const router = useRouter();
	const supabase = createClient();
	const [isLoading, setIsLoading] = useState(false);

	const [formData, setFormData] = useState({
		id: '',
		fullName: '',
		email: '', // Will populate from auth
		organizationName: '',
		organizationDomain: '',
		dob: '',
		gender: '',
		city: '',
		country: '',
	});

	// Track if user was invited (already has organization)
	const [isInvitedUser, setIsInvitedUser] = useState(false);
	const [existingOrgName, setExistingOrgName] = useState('');
	const [isCheckingUser, setIsCheckingUser] = useState(true);

	// Check if user already exists and is onboarded
	useEffect(() => {
		const checkExistingUser = async () => {
			try {
				const res = await api.get('/users/me');
				const userData = res.data;

				// If user is fully onboarded (has org and full_name), redirect to dashboard
				if (userData.organization_id && userData.full_name) {
					router.push('/dashboard');
					return;
				}

				// If user has org but no full_name, they're invited but not onboarded
				if (userData.organization_id) {
					setIsInvitedUser(true);
					setExistingOrgName(userData.organization_name || 'Your Organization');
					setFormData((prev) => ({
						...prev,
						email: userData.email || '',
						id: userData.id || '',
						fullName: userData.full_name || '',
					}));
				}

				setIsCheckingUser(false);
			} catch (error: any) {
				// User doesn't exist yet, normal signup flow
				console.log('User not found, proceeding with normal onboarding');
				setIsCheckingUser(false);
			}
		};

		checkExistingUser();
	}, [router]);

	// Load user email from Supabase auth if not already set
	useEffect(() => {
		const getUser = async () => {
			if (formData.email) return; // Already have email from API

			const {
				data: { user },
			} = await supabase.auth.getUser();
			console.log('User loaded:', user);
			if (user) {
				setFormData((prev) => ({
					...prev,
					email: prev.email || user.email || '',
					id: prev.id || user.id,
				}));
			}
		};
		getUser();
	}, [supabase.auth, formData.email]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		toast.promise(api.post('/users/onboarding', formData), {
			loading: 'Finalizing your profile...',
			success: () => {
				router.push('/dashboard');
				return 'Onboarding complete! Welcome aboard.';
			},
			error: (err: any) => err.response?.data?.error || 'Failed to complete onboarding. Please try again.',
			finally: () => setIsLoading(false),
		});
	};

	// Show loading while checking user status
	if (isCheckingUser) {
		return (
			<div className='min-h-screen bg-slate-950 flex flex-col justify-center items-center'>
				<Loader2 className='h-8 w-8 animate-spin text-orange-500' />
				<p className='mt-4 text-slate-400'>Loading...</p>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden'>
			{/* Background Gradients */}
			<div className='absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-orange-500/20 blur-[120px] rounded-full pointer-events-none' />
			<div className='absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none' />

			<div className='sm:mx-auto sm:w-full sm:max-w-md relative z-10'>
				<div className='flex justify-center mb-6'>
					<div className='h-12 w-12 rounded-xl bg-linear-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/20'>
						<User className='h-6 w-6 text-white' />
					</div>
				</div>
				<h2 className='text-center text-3xl font-bold tracking-tight text-white'>Complete your profile</h2>
				<p className='mt-2 text-center text-sm text-slate-400'>
					Tell us a bit about yourself and your organization to get started.
				</p>
			</div>

			<div className='mt-10 sm:mx-auto sm:w-full sm:max-w-[800px] relative z-10'>
				<div className='bg-slate-900/50 backdrop-blur-xl border border-slate-800 py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10'>
					<form
						className='space-y-6'
						onSubmit={handleSubmit}>
						<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
							{/* Personal Info Section */}
							<div className='space-y-6'>
								<h3 className='text-sm font-semibold text-orange-500 uppercase tracking-wider flex items-center gap-2'>
									<User className='h-4 w-4' /> Personal Details
								</h3>

								<div className='space-y-4'>
									<div>
										<label
											htmlFor='fullName'
											className='block text-sm font-medium text-slate-300 mb-1'>
											Full Name
										</label>
										<div className='relative'>
											<input
												id='fullName'
												name='fullName'
												type='text'
												required
												value={formData.fullName}
												onChange={handleChange}
												className='block w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 px-3 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-orange-500 sm:text-sm'
												placeholder='John Doe'
											/>
										</div>
									</div>

									<div>
										<label
											htmlFor='email'
											className='block text-sm font-medium text-slate-300 mb-1'>
											Email Address
										</label>
										<div className='relative'>
											<Mail className='absolute left-3 top-2.5 h-4 w-4 text-slate-500' />
											<input
												id='email'
												name='email'
												type='email'
												disabled
												value={formData.email}
												className='block w-full rounded-lg border border-slate-700 bg-slate-900/50 py-2.5 pl-10 pr-24 text-slate-400 cursor-not-allowed sm:text-sm'
											/>
											<div className='absolute right-2 top-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20'>
												<CheckCircle2 className='h-3 w-3 text-green-500' />
												<span className='text-[10px] font-medium text-green-500 uppercase tracking-wide'>Verified</span>
											</div>
										</div>
									</div>

									<div className='grid grid-cols-2 gap-4'>
										<div>
											<label
												htmlFor='dob'
												className='block text-sm font-medium text-slate-300 mb-1'>
												Date of Birth
											</label>
											<div className='relative'>
												<Calendar className='absolute left-3 top-2.5 h-4 w-4 text-slate-500' />
												<input
													id='dob'
													name='dob'
													type='date'
													required
													value={formData.dob}
													onChange={handleChange}
													className='block w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 pl-10 pr-3 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-orange-500 sm:text-sm scheme-dark'
												/>
											</div>
										</div>
										<div>
											<label
												htmlFor='gender'
												className='block text-sm font-medium text-slate-300 mb-1'>
												Gender
											</label>
											<select
												id='gender'
												name='gender'
												required
												value={formData.gender}
												onChange={handleChange}
												className='block w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 px-3 text-white focus:border-orange-500 focus:ring-orange-500 sm:text-sm appearance-none'>
												<option
													value=''
													disabled>
													Select...
												</option>
												<option value='male'>Male</option>
												<option value='female'>Female</option>
												<option value='other'>Other</option>
												<option value='undisclosed'>Prefer not to say</option>
											</select>
										</div>
									</div>
								</div>
							</div>

							{/* Organization & Location Section */}
							<div className='space-y-6'>
								<h3 className='text-sm font-semibold text-orange-500 uppercase tracking-wider flex items-center gap-2'>
									<Building2 className='h-4 w-4' /> {isInvitedUser ? 'Your Organization' : 'Organization & Location'}
								</h3>

								<div className='space-y-4'>
									{isInvitedUser ? (
										// Show read-only org info for invited users
										<div className='p-4 rounded-lg bg-slate-800/30 border border-slate-700'>
											<div className='flex items-center gap-3'>
												<div className='h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center'>
													<Building2 className='h-5 w-5 text-orange-500' />
												</div>
												<div>
													<p className='text-white font-medium'>{existingOrgName}</p>
													<p className='text-sm text-slate-400'>You've been invited to join this organization</p>
												</div>
												<CheckCircle2 className='h-5 w-5 text-green-500 ml-auto' />
											</div>
										</div>
									) : (
										// Show org input fields for new users
										<>
											<div>
												<label
													htmlFor='organizationName'
													className='block text-sm font-medium text-slate-300 mb-1'>
													Organization Name
												</label>
												<div className='relative'>
													<Building2 className='absolute left-3 top-2.5 h-4 w-4 text-slate-500' />
													<input
														id='organizationName'
														name='organizationName'
														type='text'
														required
														value={formData.organizationName}
														onChange={handleChange}
														className='block w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 pl-10 pr-3 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-orange-500 sm:text-sm'
														placeholder='Acme Inc.'
													/>
												</div>
											</div>

											<div>
												<label
													htmlFor='organizationDomain'
													className='block text-sm font-medium text-slate-300 mb-1'>
													Domain
												</label>
												<div className='relative'>
													<Globe className='absolute left-3 top-2.5 h-4 w-4 text-slate-500' />
													<input
														id='organizationDomain'
														name='organizationDomain'
														type='text'
														required
														value={formData.organizationDomain}
														onChange={handleChange}
														className='block w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 pl-10 pr-3 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-orange-500 sm:text-sm'
														placeholder='acme.inc'
													/>
												</div>
											</div>
										</>
									)}

									<div className='grid grid-cols-2 gap-4'>
										<div>
											<label
												htmlFor='city'
												className='block text-sm font-medium text-slate-300 mb-1'>
												City
											</label>
											<div className='relative'>
												<MapPin className='absolute left-3 top-2.5 h-4 w-4 text-slate-500' />
												<input
													id='city'
													name='city'
													type='text'
													required
													value={formData.city}
													onChange={handleChange}
													className='block w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 pl-10 pr-3 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-orange-500 sm:text-sm'
													placeholder='San Francisco'
												/>
											</div>
										</div>
										<div>
											<label
												htmlFor='country'
												className='block text-sm font-medium text-slate-300 mb-1'>
												Country
											</label>
											<div className='relative'>
												<Flag className='absolute left-3 top-2.5 h-4 w-4 text-slate-500' />
												<input
													id='country'
													name='country'
													type='text'
													required
													value={formData.country}
													onChange={handleChange}
													className='block w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2.5 pl-10 pr-3 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-orange-500 sm:text-sm'
													placeholder='USA'
												/>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className='pt-4 flex justify-end'>
							<button
								type='submit'
								disabled={isLoading}
								className='flex w-full sm:w-auto items-center justify-center rounded-lg bg-orange-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 hover:bg-orange-500 focus:border-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed'>
								{isLoading ? (
									<>
										<Loader2 className='mr-2 h-4 w-4 animate-spin' />
										Saving...
									</>
								) : (
									<>
										Complete Setup
										<ChevronRight className='ml-2 h-4 w-4' />
									</>
								)}
							</button>
						</div>
					</form>
				</div>

				<p className='mt-6 text-center text-xs text-slate-500'>
					By clicking "Complete Setup", you agree to our Terms of Service and Privacy Policy.
				</p>
			</div>
		</div>
	);
}
