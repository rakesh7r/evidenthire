'use client';

import { Bot } from 'lucide-react';
import Link from 'next/link';
import AuthForm from './auth-form';

export default function LoginPage() {
	return (
		<div className='relative min-h-screen flex flex-col items-center justify-center bg-slate-900 overflow-hidden'>
			{/* Animated Background Blobs */}
			<div className='absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob'></div>
			<div className='absolute top-0 -right-4 w-72 h-72 bg-orange-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000'></div>
			<div className='absolute -bottom-8 left-20 w-72 h-72 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000'></div>
			<div className='absolute bottom-40 right-20 w-64 h-64 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-blob animation-delay-6000'></div>

			{/* Content Container */}
			<div className='relative z-10 w-full max-w-md px-4'>
				{/* Logo and Title */}
				<div className='text-center mb-8'>
					<Link
						href='/'
						className='inline-flex items-center gap-3 mb-6 group'>
						<div className='flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30 group-hover:shadow-orange-500/50 transition-shadow duration-300'>
							<Bot className='h-7 w-7 text-white' />
						</div>
						<span className='text-2xl font-bold tracking-tight text-white'>EvidentHire</span>
					</Link>
					<h1 className='text-3xl font-extrabold tracking-tight text-white sm:text-4xl'>Welcome back</h1>
					<p className='mt-3 text-slate-400'>Sign in to continue to your account</p>
				</div>

				{/* Glassmorphic Card */}
				<div className='rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-xl shadow-2xl overflow-hidden'>
					<div className='p-8'>
						<AuthForm />
					</div>

					{/* Decorative bottom gradient */}
					<div className='h-1 w-full bg-linear-to-r from-orange-500 via-teal-500 to-purple-500'></div>
				</div>

				{/* Footer */}
				<p className='mt-8 text-center text-sm text-slate-500'>
					New to EvidentHire?{' '}
					<Link
						href='/'
						className='font-semibold text-orange-400 hover:text-orange-300 transition-colors'>
						Learn more about us
					</Link>
				</p>
			</div>

			{/* Subtle grid pattern overlay */}
			<div className='absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-size-[4rem_4rem] opacity-30'></div>
		</div>
	);
}
