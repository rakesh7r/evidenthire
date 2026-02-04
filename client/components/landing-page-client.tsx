'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
	ArrowRight,
	Bot,
	CheckCircle,
	FileText,
	LineChart,
	Mic,
	ShieldCheck,
	Users,
	X,
	Sparkles,
	Brain,
	Calendar,
	MessageSquare,
	Zap,
	Target,
	TrendingUp,
	Star,
	Play,
} from 'lucide-react';
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
			setStatus('success');
		} catch (error: any) {
			setStatus('error');
			const errorMsg = error.response?.data?.error || error.message || 'Something went wrong';
			setMessage(errorMsg);
		}
	};

	const features = [
		{
			icon: FileText,
			title: 'AI-Powered Job Board',
			description: 'Replace your company job boards with a modern, customizable careers page that attracts top talent.',
			color: 'from-blue-500 to-cyan-500',
		},
		{
			icon: Brain,
			title: 'Smart ATS Scoring',
			description: 'Automatically screen resumes and rank candidates based on job requirements and skill matching.',
			color: 'from-purple-500 to-pink-500',
		},
		{
			icon: Calendar,
			title: 'In-App Scheduling',
			description: 'Schedule and host video interviews directly in the platform. No more calendar ping-pong.',
			color: 'from-orange-500 to-red-500',
		},
		{
			icon: LineChart,
			title: 'Interview Depth Reports',
			description: 'Get detailed performance reports based on interview transcriptions and AI analysis.',
			color: 'from-emerald-500 to-teal-500',
		},
		{
			icon: MessageSquare,
			title: 'RAG-Powered Chat',
			description: 'Ask questions like "Why this candidate?" and get instant, evidence-based answers.',
			color: 'from-pink-500 to-rose-500',
		},
		{
			icon: Target,
			title: 'Bias-Free Evaluation',
			description: 'Objective scoring based on skills and qualifications, not unconscious preferences.',
			color: 'from-amber-500 to-orange-500',
		},
	];

	const stats = [
		{ value: '3x', label: 'Faster Hiring', icon: Zap },
		{ value: '85%', label: 'Time Saved', icon: TrendingUp },
		{ value: '99%', label: 'Accuracy', icon: Target },
		{ value: '4.9', label: 'User Rating', icon: Star },
	];

	return (
		<div className='min-h-screen bg-slate-950 font-sans text-white overflow-x-hidden'>
			{/* Animated Background */}
			<div className='fixed inset-0 overflow-hidden pointer-events-none'>
				<div className='absolute top-0 -left-4 w-[500px] h-[500px] bg-purple-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse'></div>
				<div
					className='absolute top-1/4 -right-4 w-[600px] h-[600px] bg-orange-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse'
					style={{ animationDelay: '1s' }}></div>
				<div
					className='absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-teal-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse'
					style={{ animationDelay: '2s' }}></div>
				<div
					className='absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-pink-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-15 animate-pulse'
					style={{ animationDelay: '3s' }}></div>
			</div>

			{/* Navbar */}
			<nav className='sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-xl'>
				<div className='mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8'>
					<div className='flex items-center gap-3'>
						<div className='flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 shadow-lg shadow-orange-500/25'>
							<Bot className='h-6 w-6 text-white' />
						</div>
						<span className='text-xl font-bold tracking-tight'>EvidentHire</span>
					</div>
					<div className='flex items-center gap-4'>
						{user ? (
							<div className='flex items-center gap-4'>
								<span className='hidden text-sm text-slate-400 sm:inline-block'>{user.email}</span>
								<Link
									href='/dashboard'
									className='rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:scale-105'>
									Dashboard
								</Link>
							</div>
						) : !isWaitlist ? (
							<Link
								href='/login'
								className='rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:scale-105'>
								Sign In
							</Link>
						) : (
							<button
								onClick={openModal}
								className='rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:scale-105'>
								Join Waitlist
							</button>
						)}
					</div>
				</div>
			</nav>

			<main className='relative'>
				{/* Hero Section */}
				<section className='relative pt-20 pb-32 lg:pt-32 lg:pb-40'>
					<div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
						<div className='text-center'>
							{/* Badge */}
							<div className='inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 mb-8 backdrop-blur-sm'>
								<Sparkles className='h-4 w-4 text-orange-400 mr-2 animate-pulse' />
								<span className='text-sm font-medium text-orange-400'>
									{isWaitlist ? 'Early Access – Join the Waitlist' : 'Now Available'}
								</span>
							</div>

							{/* Headline */}
							<h1 className='mx-auto max-w-5xl text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl'>
								Hire Smarter.
								<br />
								<span className='text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 animate-gradient'>
									Hire Faster.
								</span>
							</h1>

							{/* Subheadline */}
							<p className='mx-auto mt-6 max-w-2xl text-lg text-slate-400 sm:text-xl leading-relaxed'>
								The all-in-one AI hiring platform that replaces job boards, automates screening, hosts interviews, and
								finds you the perfect candidate—with evidence.
							</p>

							{/* CTA Buttons */}
							<div className='mt-10 flex flex-col sm:flex-row justify-center gap-4'>
								{user ? (
									<Link
										href='/dashboard'
										className='group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-orange-500/25 transition-all hover:scale-105 hover:shadow-orange-500/40'>
										Go to Dashboard
										<ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
									</Link>
								) : isWaitlist ? (
									<button
										onClick={openModal}
										className='group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-orange-500/25 transition-all hover:scale-105 hover:shadow-orange-500/40'>
										Join Waitlist – It's Free
										<ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
									</button>
								) : (
									<Link
										href='/login'
										className='group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-orange-500/25 transition-all hover:scale-105 hover:shadow-orange-500/40'>
										Start Hiring Free
										<ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
									</Link>
								)}
								<button className='group inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-white/10 hover:border-white/30'>
									<Play className='h-5 w-5' />
									Watch Demo
								</button>
							</div>

							{/* Stats */}
							<div className='mt-20 grid grid-cols-2 gap-4 sm:grid-cols-4 max-w-3xl mx-auto'>
								{stats.map((stat, i) => (
									<div
										key={i}
										className='group rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-6 transition-all hover:bg-white/10 hover:border-orange-500/30'>
										<stat.icon className='h-6 w-6 text-orange-400 mx-auto mb-2 group-hover:scale-110 transition-transform' />
										<div className='text-3xl font-bold text-white'>{stat.value}</div>
										<div className='text-sm text-slate-400'>{stat.label}</div>
									</div>
								))}
							</div>
						</div>

						{/* App Preview */}
						<div className='relative mx-auto mt-20 max-w-5xl'>
							<div className='absolute inset-0 bg-gradient-to-r from-orange-500/20 via-pink-500/20 to-purple-500/20 blur-3xl rounded-3xl'></div>
							<div className='relative rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-2 shadow-2xl'>
								<div className='rounded-xl bg-slate-900 border border-white/5 overflow-hidden'>
									{/* Browser Chrome */}
									<div className='flex items-center gap-2 border-b border-white/5 bg-slate-800/50 px-4 py-3'>
										<div className='flex gap-1.5'>
											<div className='w-3 h-3 rounded-full bg-red-500'></div>
											<div className='w-3 h-3 rounded-full bg-yellow-500'></div>
											<div className='w-3 h-3 rounded-full bg-green-500'></div>
										</div>
										<div className='flex-1 flex justify-center'>
											<div className='h-6 w-64 rounded-md bg-slate-700/50 flex items-center justify-center text-xs text-slate-400'>
												evidenthire.com/dashboard
											</div>
										</div>
									</div>
									{/* App Content Preview */}
									<div className='p-6 grid grid-cols-3 gap-6'>
										<div className='col-span-2 space-y-4'>
											{/* Header */}
											<div className='flex items-center justify-between'>
												<div className='h-8 w-48 rounded-lg bg-gradient-to-r from-orange-500/20 to-pink-500/20'></div>
												<div className='h-8 w-8 rounded-lg bg-slate-700'></div>
											</div>
											{/* Cards */}
											<div className='grid grid-cols-3 gap-4'>
												<div className='h-24 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 p-4'>
													<div className='h-3 w-12 rounded bg-blue-500/30 mb-2'></div>
													<div className='text-2xl font-bold text-blue-400'>24</div>
													<div className='h-2 w-16 rounded bg-slate-600 mt-2'></div>
												</div>
												<div className='h-24 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 p-4'>
													<div className='h-3 w-12 rounded bg-emerald-500/30 mb-2'></div>
													<div className='text-2xl font-bold text-emerald-400'>89%</div>
													<div className='h-2 w-16 rounded bg-slate-600 mt-2'></div>
												</div>
												<div className='h-24 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 p-4'>
													<div className='h-3 w-12 rounded bg-purple-500/30 mb-2'></div>
													<div className='text-2xl font-bold text-purple-400'>12</div>
													<div className='h-2 w-16 rounded bg-slate-600 mt-2'></div>
												</div>
											</div>
											{/* List */}
											<div className='space-y-3'>
												{[1, 2, 3].map((i) => (
													<div
														key={i}
														className='flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-white/5'>
														<div className='h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500'></div>
														<div className='flex-1'>
															<div className='h-3 w-32 rounded bg-slate-600 mb-2'></div>
															<div className='h-2 w-48 rounded bg-slate-700'></div>
														</div>
														<div className='h-6 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/30'></div>
													</div>
												))}
											</div>
										</div>
										{/* Sidebar */}
										<div className='space-y-4'>
											<div className='h-40 rounded-xl bg-gradient-to-br from-teal-500/10 to-emerald-500/10 border border-teal-500/20 p-4'>
												<div className='flex items-center gap-2 text-teal-400 mb-3'>
													<CheckCircle className='h-4 w-4' />
													<span className='text-sm font-semibold'>AI Match</span>
												</div>
												<div className='h-2 w-full rounded-full bg-slate-700 mb-2'>
													<div className='h-2 w-[92%] rounded-full bg-gradient-to-r from-teal-500 to-emerald-500'></div>
												</div>
												<div className='h-2 w-3/4 rounded bg-slate-700 mt-4'></div>
												<div className='h-2 w-1/2 rounded bg-slate-700 mt-2'></div>
											</div>
											<div className='h-32 rounded-xl bg-slate-800/50 border border-white/5 p-4'>
												<div className='flex items-center gap-2 mb-3'>
													<Bot className='h-4 w-4 text-orange-400' />
													<span className='text-xs font-semibold text-slate-300'>AI Assistant</span>
												</div>
												<div className='space-y-2'>
													<div className='h-2 w-full rounded bg-slate-700'></div>
													<div className='h-2 w-4/5 rounded bg-slate-700'></div>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Features Section */}
				<section className='relative py-24 sm:py-32'>
					<div className='mx-auto max-w-7xl px-6 lg:px-8'>
						<div className='text-center mb-16'>
							<div className='inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 mb-6'>
								<Zap className='h-4 w-4 text-purple-400 mr-2' />
								<span className='text-sm font-medium text-purple-400'>Powerful Features</span>
							</div>
							<h2 className='text-4xl font-bold tracking-tight sm:text-5xl'>
								Everything you need to hire
								<br />
								<span className='text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500'>
									the best talent
								</span>
							</h2>
							<p className='mx-auto mt-4 max-w-2xl text-lg text-slate-400'>
								One platform to replace your entire hiring stack. From job posting to final offer.
							</p>
						</div>

						<div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
							{features.map((feature, i) => (
								<div
									key={i}
									className='group relative rounded-2xl bg-white/5 border border-white/10 p-8 transition-all duration-300 hover:bg-white/10 hover:border-orange-500/30 hover:scale-[1.02]'>
									<div
										className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
										<feature.icon className='h-6 w-6 text-white' />
									</div>
									<h3 className='text-xl font-bold text-white mb-3'>{feature.title}</h3>
									<p className='text-slate-400 leading-relaxed'>{feature.description}</p>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* How It Works */}
				<section className='relative py-24 sm:py-32 bg-gradient-to-b from-transparent via-slate-900/50 to-transparent'>
					<div className='mx-auto max-w-7xl px-6 lg:px-8'>
						<div className='text-center mb-16'>
							<h2 className='text-4xl font-bold tracking-tight sm:text-5xl'>How It Works</h2>
							<p className='mx-auto mt-4 max-w-2xl text-lg text-slate-400'>
								From candidate application to hired in three simple steps
							</p>
						</div>

						<div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
							{[
								{
									step: '01',
									title: 'Post & Attract',
									description:
										'Create beautiful job listings and attract qualified candidates with your branded careers page.',
									color: 'from-orange-500 to-red-500',
								},
								{
									step: '02',
									title: 'Screen & Interview',
									description: 'AI scores applications automatically. Schedule and host video interviews in one click.',
									color: 'from-purple-500 to-pink-500',
								},
								{
									step: '03',
									title: 'Analyze & Hire',
									description:
										'Get AI-powered insights, compare candidates objectively, and make confident hiring decisions.',
									color: 'from-teal-500 to-cyan-500',
								},
							].map((item, i) => (
								<div
									key={i}
									className='relative'>
									<div className='text-8xl font-black text-white/5 absolute -top-8 -left-4'>{item.step}</div>
									<div className='relative rounded-2xl bg-white/5 border border-white/10 p-8 h-full'>
										<div className={`h-1 w-20 rounded-full bg-gradient-to-r ${item.color} mb-6`}></div>
										<h3 className='text-2xl font-bold text-white mb-4'>{item.title}</h3>
										<p className='text-slate-400 leading-relaxed'>{item.description}</p>
									</div>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* Testimonial / Quote */}
				<section className='relative py-24'>
					<div className='mx-auto max-w-4xl px-6 lg:px-8 text-center'>
						<div className='inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 shadow-xl shadow-orange-500/25 mb-8'>
							<ShieldCheck className='h-8 w-8 text-white' />
						</div>
						<blockquote className='text-3xl font-bold text-white leading-relaxed mb-6'>
							"EvidentHire helped us reduce time-to-hire by 60% while improving candidate quality. The AI insights are
							game-changing."
						</blockquote>
						<div className='flex items-center justify-center gap-4'>
							<div className='h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500'></div>
							<div className='text-left'>
								<div className='font-semibold text-white'>Sarah Chen</div>
								<div className='text-sm text-slate-400'>VP of People, TechCorp</div>
							</div>
						</div>
					</div>
				</section>

				{/* Final CTA */}
				<section className='relative py-24 sm:py-32'>
					<div className='absolute inset-0 bg-gradient-to-t from-orange-500/10 via-transparent to-transparent'></div>
					<div className='relative mx-auto max-w-4xl px-6 lg:px-8 text-center'>
						<h2 className='text-4xl font-bold tracking-tight sm:text-5xl mb-6'>
							Ready to transform your
							<br />
							<span className='text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500'>
								hiring process?
							</span>
						</h2>
						<p className='mx-auto max-w-xl text-lg text-slate-400 mb-10'>
							Join hundreds of companies already using EvidentHire to find and hire the best talent, faster.
						</p>
						<div className='flex flex-col sm:flex-row justify-center gap-4'>
							{isWaitlist ? (
								<button
									onClick={openModal}
									className='group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-10 py-5 text-xl font-bold text-white shadow-xl shadow-orange-500/25 transition-all hover:scale-105 hover:shadow-orange-500/40'>
									Get Early Access
									<ArrowRight className='h-6 w-6 transition-transform group-hover:translate-x-1' />
								</button>
							) : (
								<Link
									href={user ? '/dashboard' : '/login'}
									className='group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-10 py-5 text-xl font-bold text-white shadow-xl shadow-orange-500/25 transition-all hover:scale-105 hover:shadow-orange-500/40'>
									{user ? 'Go to Dashboard' : 'Start Free Today'}
									<ArrowRight className='h-6 w-6 transition-transform group-hover:translate-x-1' />
								</Link>
							)}
						</div>
					</div>
				</section>
			</main>

			{/* Footer */}
			<footer className='relative border-t border-white/10 py-12'>
				<div className='mx-auto max-w-7xl px-6 lg:px-8'>
					<div className='flex flex-col items-center justify-between gap-6 sm:flex-row'>
						<div className='flex items-center gap-3'>
							<div className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-pink-500'>
								<Bot className='h-5 w-5 text-white' />
							</div>
							<span className='text-lg font-bold'>EvidentHire</span>
						</div>
						<p className='text-sm text-slate-500'>© {new Date().getFullYear()} EvidentHire. All rights reserved.</p>
						<div className='flex gap-6'>
							<a
								href='#'
								className='text-sm text-slate-500 hover:text-white transition-colors'>
								Privacy
							</a>
							<a
								href='#'
								className='text-sm text-slate-500 hover:text-white transition-colors'>
								Terms
							</a>
							<a
								href='#'
								className='text-sm text-slate-500 hover:text-white transition-colors'>
								Contact
							</a>
						</div>
					</div>
				</div>
			</footer>

			{/* Waitlist Modal */}
			{isModalOpen && (
				<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200'>
					<div className='relative w-full max-w-md overflow-hidden rounded-3xl bg-slate-900 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200'>
						<button
							onClick={closeModal}
							className='absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors'>
							<X className='w-5 h-5' />
						</button>

						{status === 'success' ? (
							<div className='p-10 text-center'>
								<div className='flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 mb-6 shadow-lg shadow-emerald-500/25'>
									<CheckCircle className='h-8 w-8 text-white' />
								</div>
								<h3 className='text-2xl font-bold text-white mb-3'>You're on the list!</h3>
								<p className='text-slate-400 mb-8'>Thanks for your interest. We'll notify you when it's your turn.</p>
								<button
									onClick={closeModal}
									className='w-full py-4 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold hover:scale-105 transition-transform'>
									Back to Homepage
								</button>
							</div>
						) : (
							<div className='p-10'>
								<div className='flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-pink-500 mb-6 shadow-lg shadow-orange-500/25'>
									<Sparkles className='h-7 w-7 text-white' />
								</div>
								<h3 className='text-2xl font-bold text-white text-center mb-2'>Get Early Access</h3>
								<p className='text-slate-400 text-center mb-8'>
									Be the first to experience the future of hiring. No spam, we promise.
								</p>

								<form
									onSubmit={handleSubmit}
									className='space-y-4'>
									<div>
										<label
											htmlFor='email'
											className='block text-sm font-medium text-slate-300 mb-2'>
											Work Email
										</label>
										<input
											type='email'
											id='email'
											required
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											className='w-full px-5 py-4 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all'
											placeholder='you@company.com'
										/>
									</div>

									{status === 'error' && (
										<p className='text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3'>
											{message}
										</p>
									)}

									<button
										type='submit'
										disabled={status === 'loading'}
										className='w-full py-4 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold hover:scale-105 transition-transform disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2'>
										{status === 'loading' ? (
											<>
												<div className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin'></div>
												Joining...
											</>
										) : (
											<>
												Join Waitlist
												<ArrowRight className='w-5 h-5' />
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
