'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, CheckCircle, FileText, LineChart, Mic, ShieldCheck, Users, X } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { createClient } from '@/utils/supabase/client';

interface LandingPageProps {
	user: any;
	isWaitlist: boolean;
	code?: string;
}

export default function LandingPageClient({ user, isWaitlist, code }: LandingPageProps) {
	const router = useRouter();
	const supabase = createClient();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [email, setEmail] = useState('');
	const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
	const [message, setMessage] = useState('');

	useEffect(() => {
		if (code) {
			const processAuth = async () => {
				await supabase.auth.exchangeCodeForSession(code);
			};
			processAuth();
		}
	}, [code, supabase]);

	useEffect(() => {
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			if (event === 'PASSWORD_RECOVERY') {
				router.push('/reset-password');
			} else if (event === 'SIGNED_IN' && code) {
				// Default to reset password page for codes landing on root,
				// as this covers the "Reset Password" flow where 'type' param is missing.
				setTimeout(() => {
					if (window.location.pathname !== '/reset-password') {
						router.push('/reset-password');
					}
				}, 500);
			}
		});
		return () => subscription.unsubscribe();
	}, [supabase, router, code]);

	const openModal = (e: React.MouseEvent) => {
		if (isWaitlist) {
			e.preventDefault();
			setIsModalOpen(true);
		}
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setStatus('idle');
		setEmail('');
		setMessage('');
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setStatus('loading');

		try {
			const response = await api.post('/waitlist', { email });
			// axios throws on non-2xx by default, so we don't need manual !response.ok check usually,
			// but we can access response.data directly.

			// data is already parsed json in axios
			// const data = response.data;

			setStatus('success');
		} catch (error: any) {
			setStatus('error');
			// axios errors have a specific structure
			const errorMsg = error.response?.data?.error || error.message || 'Something went wrong';
			setMessage(errorMsg);
		}
	};

	return (
		<div className='min-h-screen bg-slate-50 font-sans text-slate-900'>
			{/* Navbar */}
			<nav className='sticky top-0 z-50 w-full border-b border-white/10 bg-slate-900/80 backdrop-blur-md'>
				<div className='mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8'>
					<div className='flex items-center gap-2'>
						<div className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20'>
							<Bot className='h-5 w-5 text-white' />
						</div>
						<span className='text-xl font-bold tracking-tight text-white'>EvidentHire</span>
					</div>
					<div className='flex items-center gap-4'>
						{user ? (
							<div className='flex items-center gap-4'>
								<span className='hidden text-sm text-slate-300 sm:inline-block'>{user.email}</span>
								{/* Simplified Sign Out for Client Component - Ideally use server action wrapper or link */}
								<Link
									href='/api/auth/signout'
									className='rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700'>
									Sign Out
								</Link>
							</div>
						) : !isWaitlist ? (
							<Link
								href='/login'
								className='rounded-full bg-orange-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-500 hover:shadow-orange-500/40 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900'>
								Sign In
							</Link>
						) : (
							<button
								onClick={openModal}
								className='rounded-full bg-orange-600 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-500 hover:shadow-orange-500/40 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900'>
								Join Waitlist
							</button>
						)}
					</div>
				</div>
			</nav>

			<main className='flex flex-col'>
				{/* Hero Section */}
				<section className='relative overflow-hidden bg-slate-900 pt-20 pb-32 lg:pt-32'>
					{/* Background Elements */}
					<div className='absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob'></div>
					<div className='absolute top-0 -right-4 w-72 h-72 bg-orange-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000'></div>
					<div className='absolute -bottom-8 left-20 w-72 h-72 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000'></div>

					<div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center'>
						{!isWaitlist && (
							<div className='inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 mb-8 backdrop-blur-sm'>
								<span className='flex h-2 w-2 rounded-full bg-orange-500 mr-2'></span>
								<span className='text-sm font-medium text-orange-400'>Now Available</span>
							</div>
						)}
						{isWaitlist && (
							<div className='inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 mb-8 backdrop-blur-sm'>
								<span className='flex h-2 w-2 rounded-full bg-orange-500 mr-2'></span>
								<span className='text-sm font-medium text-orange-400'>Waitlist Now Open</span>
							</div>
						)}

						<h1 className='mx-auto max-w-4xl text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl'>
							Stop Guessing.{' '}
							<span className='text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600'>
								Start Hiring.
							</span>
							<br />
							The Future of Interview Feedback.
						</h1>

						<p className='mx-auto mt-6 max-w-2xl text-lg text-slate-300 sm:text-xl'>
							Objective performance reports generated instantly from your interview transcriptions. Eliminate bias and
							save hours of manual note-taking.
						</p>

						<div className='mt-10 flex justify-center gap-4'>
							{/* Primary CTA */}
							{user ? (
								<Link
									href='#'
									className='group flex items-center justify-center gap-2 rounded-full bg-orange-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-orange-500/20 transition-all hover:scale-105 hover:bg-orange-500 hover:shadow-orange-500/40'>
									Go to Dashboard
									<ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
								</Link>
							) : isWaitlist ? (
								<button
									onClick={openModal}
									className='group flex items-center justify-center gap-2 rounded-full bg-orange-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-orange-500/20 transition-all hover:scale-105 hover:bg-orange-500 hover:shadow-orange-500/40'>
									Join Waitlist
									<ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
								</button>
							) : (
								<Link
									href='/login'
									className='group flex items-center justify-center gap-2 rounded-full bg-orange-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-orange-500/20 transition-all hover:scale-105 hover:bg-orange-500 hover:shadow-orange-500/40'>
									Get Started
									<ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
								</Link>
							)}
						</div>
						{/* Mockup / Visual */}
						<div className='relative mx-auto mt-16 max-w-5xl'>
							<div className='rounded-2xl border border-slate-700 bg-slate-800/50 p-2 backdrop-blur-xl shadow-2xl'>
								<div className='rounded-xl bg-slate-900 border border-slate-700 overflow-hidden'>
									<div className='flex items-center gap-2 border-b border-slate-800 bg-slate-900/50 px-4 py-3'>
										<div className='flex gap-1.5'>
											<div className='w-3 h-3 rounded-full bg-red-500'></div>
											<div className='w-3 h-3 rounded-full bg-yellow-500'></div>
											<div className='w-3 h-3 rounded-full bg-green-500'></div>
										</div>
										<div className='ml-4 h-6 w-full max-w-sm rounded-md bg-slate-800/50'></div>
									</div>
									<div className='p-8 grid grid-cols-3 gap-8 text-left'>
										<div className='col-span-2 space-y-6'>
											<div className='space-y-2'>
												<div className='h-4 w-1/4 rounded bg-slate-700'></div>
												<div className='h-40 rounded-lg bg-slate-800 border border-slate-700 p-4'>
													<div className='flex gap-4 mb-4'>
														<div className='h-10 w-10 rounded-full bg-orange-500/20'></div>
														<div className='flex-1 space-y-2'>
															<div className='h-3 w-1/3 rounded bg-slate-600'></div>
															<div className='h-2 w-full rounded bg-slate-700'></div>
														</div>
													</div>
													<div className='space-y-2'>
														<div className='h-2 w-full rounded bg-slate-700'></div>
														<div className='h-2 w-5/6 rounded bg-slate-700'></div>
														<div className='h-2 w-4/6 rounded bg-slate-700'></div>
													</div>
												</div>
											</div>
											<div className='grid grid-cols-2 gap-4'>
												<div className='h-24 rounded-lg bg-slate-800 border border-slate-700'></div>
												<div className='h-24 rounded-lg bg-slate-800 border border-slate-700'></div>
											</div>
										</div>
										<div className='col-span-1 space-y-4'>
											<div className='h-32 rounded-lg bg-teal-500/10 border border-teal-500/20 p-4'>
												<div className='flex items-center gap-2 text-teal-400 mb-2'>
													<CheckCircle className='h-4 w-4' />
													<span className='text-sm font-semibold'>Strong Alignment</span>
												</div>
												<div className='h-2 w-full rounded bg-teal-500/20 mb-2'></div>
												<div className='h-2 w-3/4 rounded bg-teal-500/20'></div>
											</div>
											<div className='h-48 rounded-lg bg-slate-800 border border-slate-700 p-4'>
												<div className='h-4 w-1/2 rounded bg-slate-700 mb-4'></div>
												<div className='space-y-2'>
													<div className='flex justify-between text-xs text-slate-400'>
														<span>Technical</span>
														<span>92%</span>
													</div>
													<div className='h-1.5 w-full rounded-full bg-slate-700'>
														<div className='h-1.5 w-[92%] rounded-full bg-orange-500'></div>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Problem / Solution */}
				<section className='bg-white py-24 sm:py-32'>
					<div className='mx-auto max-w-7xl px-6 lg:px-8'>
						<div className='mx-auto max-w-2xl text-center'>
							<h2 className='text-base font-semibold leading-7 text-orange-600'>The Problem</h2>
							<p className='mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl'>
								Interviewing is broken.
							</p>
							<p className='mt-6 text-lg leading-8 text-slate-600'>
								Inconsistent feedback, unconscious bias, and time-consuming report writing slows down your team.
								<br className='hidden sm:inline' />
								<span className='font-semibold text-slate-900'>EvidentHire</span> is your easy, unbiased, and
								comprehensive platform for all your hiring needs.
							</p>
						</div>
					</div>
				</section>

				{/* Features */}
				<section className='bg-slate-50 py-24 sm:py-32'>
					<div className='mx-auto max-w-7xl px-6 lg:px-8'>
						<div className='mx-auto max-w-2xl text-center mb-16'>
							<h2 className='text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl'>
								Everything you need to hire with confidence.
							</h2>
						</div>

						<div className='grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2 lg:gap-y-8'>
							{/* Feature 1 */}
							<div className='relative pl-16'>
								<div className='absolute top-0 left-0 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600'>
									<Users className='h-6 w-6 text-white' />
								</div>
								<h3 className='text-base font-semibold leading-7 text-slate-900'>Customizable Interview Pipeline</h3>
								<p className='mt-2 text-base leading-7 text-slate-600'>
									Select the interview type (Screening, Technical, System Design, Behavioral) to ensure apples-to-apples
									comparisons for every candidate.
								</p>
							</div>

							{/* Feature 2 */}
							<div className='relative pl-16'>
								<div className='absolute top-0 left-0 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600'>
									<FileText className='h-6 w-6 text-white' />
								</div>
								<h3 className='text-base font-semibold leading-7 text-slate-900'>Role-Based Position Generation</h3>
								<p className='mt-2 text-base leading-7 text-slate-600'>
									Define roles and required skills through a simple setup. The AI contextualizes every interview against
									your specific job requirements.
								</p>
							</div>

							{/* Feature 3 */}
							<div className='relative pl-16'>
								<div className='absolute top-0 left-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600'>
									<Mic className='h-6 w-6 text-white' />
								</div>
								<h3 className='text-base font-semibold leading-7 text-slate-900'>
									Seamless Interview Hosting & Recording
								</h3>
								<p className='mt-2 text-base leading-7 text-slate-600'>
									Connect via a secure Livekit video call that supports screen sharing and recording. A professional,
									all-in-one platform.
								</p>
							</div>

							{/* Feature 4 */}
							<div className='relative pl-16'>
								<div className='absolute top-0 left-0 flex h-10 w-10 items-center justify-center rounded-lg bg-pink-600'>
									<LineChart className='h-6 w-6 text-white' />
								</div>
								<h3 className='text-base font-semibold leading-7 text-slate-900'>Automated, In-Depth Reporting</h3>
								<p className='mt-2 text-base leading-7 text-slate-600'>
									Get Alignment Summaries, detailed Strength/Risk Matrices, and Comparison Views without manual
									note-taking.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* Quality Safeguard */}
				<section className='relative isolate overflow-hidden bg-slate-900 px-6 py-24 sm:py-32 lg:px-8'>
					<div className='absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.indigo.100),white)] opacity-20' />
					<div className='absolute inset-y-0 right-1/2 -z-10 mr-16 w-[200%] origin-bottom-left skew-x-[-30deg] bg-slate-900 shadow-xl shadow-indigo-600/10 ring-1 ring-indigo-50 sm:mr-28 lg:mr-0 xl:mr-16 xl:origin-center' />

					<div className='mx-auto max-w-2xl lg:max-w-4xl text-center'>
						<div className='flex justify-center mb-6'>
							<div className='flex h-12 w-12 items-center justify-center rounded-full bg-orange-600/10 border border-orange-500/50'>
								<ShieldCheck className='h-6 w-6 text-orange-500' />
							</div>
						</div>
						<h2 className='text-3xl font-bold tracking-tight text-white sm:text-4xl'>Built-in Quality Safeguards</h2>
						<p className='mt-4 text-lg text-slate-300'>
							We prioritize accuracy. Our Signal Quality Check monitors audio clarity and transcript confidence. If the
							signal is weak, we explicitly downgrade confidence to avoid guessing.
						</p>
						<blockquote className='mt-8 text-xl font-medium italic text-orange-400'>
							"Silence is better than confident nonsense."
						</blockquote>
					</div>
				</section>

				{/* CTA Section */}
				<section className='bg-white py-24'>
					<div className='mx-auto max-w-7xl px-6 lg:px-8 text-center'>
						<h2 className='text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl'>
							Ready to transform your hiring process?
						</h2>
						<p className='mx-auto mt-4 max-w-xl text-lg text-slate-600'>
							Be among the first to experience the future of interview reviews. Secure your spot now.
						</p>
						<div className='mt-10 flex items-center justify-center gap-x-6'>
							{isWaitlist ? (
								<button
									onClick={openModal}
									className='rounded-full bg-orange-600 px-8 py-3.5 text-lg font-semibold text-white shadow-xl shadow-orange-500/20 hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600'>
									Secure Your Spot Now – Join Waitlist
								</button>
							) : (
								<Link
									href={user ? '#' : '/login'}
									className='rounded-full bg-orange-600 px-8 py-3.5 text-lg font-semibold text-white shadow-xl shadow-orange-500/20 hover:bg-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600'>
									{user ? 'Go to Dashboard' : 'Get Started'}
								</Link>
							)}
						</div>
					</div>
				</section>
			</main>

			{/* Footer */}
			<footer className='bg-slate-900 py-12'>
				<div className='mx-auto max-w-7xl px-6 lg:px-8'>
					<div className='flex flex-col items-center justify-between gap-6 sm:flex-row'>
						<div className='flex items-center gap-2'>
							<Bot className='h-6 w-6 text-orange-500' />
							<span className='text-lg font-bold text-white'>EvidentHire</span>
						</div>
						<p className='text-sm text-slate-400'>© {new Date().getFullYear()} EvidentHire. All rights reserved.</p>
						<div className='flex gap-6'>
							<a
								href='#'
								className='text-sm text-slate-400 hover:text-white'>
								Privacy
							</a>
							<a
								href='#'
								className='text-sm text-slate-400 hover:text-white'>
								Terms
							</a>
						</div>
					</div>
				</div>
			</footer>

			{/* Modal */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200'>
					<div className='relative w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200'>
						<button
							onClick={closeModal}
							className='absolute top-4 right-4 text-gray-500 hover:text-gray-700 focus:outline-none'>
							<X className='w-5 h-5' />
						</button>

						{status === 'success' ? (
							<div className='p-8 text-center'>
								<div className='flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-orange-100 mb-4'>
									<CheckCircle className='h-6 w-6 text-orange-600' />
								</div>
								<h3 className='text-xl font-bold text-gray-900 mb-2'>You're on the list!</h3>
								<p className='text-gray-600 mb-6'>Thanks for showing interest in us. We'll get back to you ASAP.</p>
								<button
									onClick={closeModal}
									className='w-full py-3 bg-orange-600 text-white rounded-full font-semibold hover:bg-orange-500 transition-colors'>
									Back to Homepage
								</button>
							</div>
						) : (
							<div className='p-8'>
								<h3 className='text-2xl font-bold text-gray-900 mb-2'>Join the Waitlist</h3>
								<p className='text-gray-600 mb-6'>Be the first to know when we launch. No spam, we promise.</p>

								<form
									onSubmit={handleSubmit}
									className='space-y-4'>
									<div>
										<label
											htmlFor='email'
											className='block text-sm font-medium text-gray-700 mb-1'>
											Email address
										</label>
										<input
											type='email'
											id='email'
											required
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-slate-900 bg-white'
											placeholder='you@company.com'
										/>
									</div>

									{status === 'error' && <p className='text-red-500 text-sm'>{message}</p>}

									<button
										type='submit'
										disabled={status === 'loading'}
										className='w-full py-3 bg-orange-600 text-white rounded-full font-bold hover:bg-orange-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2'>
										{status === 'loading' ? (
											<>
												<div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin'></div>
												Joining...
											</>
										) : (
											<>
												Join Waitlist
												<ArrowRight className='w-4 h-4' />
											</>
										)}
									</button>
								</form>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
