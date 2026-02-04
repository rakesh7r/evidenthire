'use client';

import { useState, useEffect } from 'react';
import {
	Bot,
	Briefcase,
	MapPin,
	Clock,
	ChevronRight,
	Search,
	Sparkles,
	Building2,
	Users,
	Zap,
	Star,
} from 'lucide-react';
import Link from 'next/link';
import ApplicationModal from './application-modal';

// Mock data for positions - this will be replaced with actual API data later
const mockPositions = [
	{
		id: '1',
		title: 'Senior Frontend Engineer',
		department: 'Engineering',
		location: 'Remote',
		type: 'Full-time',
		description: 'Build next-generation user interfaces with React, TypeScript, and modern web technologies.',
		requirements: {
			skills: [
				{ name: 'React', level: 'senior' },
				{ name: 'TypeScript', level: 'senior' },
				{ name: 'Node.js', level: 'intermediate' },
			],
		},
		posted_at: '2024-01-15',
	},
	{
		id: '2',
		title: 'Full Stack Developer',
		department: 'Engineering',
		location: 'San Francisco, CA',
		type: 'Full-time',
		description: 'Design and implement scalable backend services and intuitive frontend experiences.',
		requirements: {
			skills: [
				{ name: 'Python', level: 'senior' },
				{ name: 'React', level: 'intermediate' },
				{ name: 'PostgreSQL', level: 'intermediate' },
			],
		},
		posted_at: '2024-01-20',
	},
	{
		id: '3',
		title: 'Product Designer',
		department: 'Design',
		location: 'New York, NY',
		type: 'Full-time',
		description: 'Create beautiful, intuitive designs that delight users and drive business growth.',
		requirements: {
			skills: [
				{ name: 'Figma', level: 'senior' },
				{ name: 'UI/UX', level: 'senior' },
				{ name: 'Prototyping', level: 'intermediate' },
			],
		},
		posted_at: '2024-01-22',
	},
	{
		id: '4',
		title: 'DevOps Engineer',
		department: 'Engineering',
		location: 'Remote',
		type: 'Full-time',
		description: 'Build and maintain infrastructure that powers our platform at scale.',
		requirements: {
			skills: [
				{ name: 'Kubernetes', level: 'senior' },
				{ name: 'AWS', level: 'senior' },
				{ name: 'Terraform', level: 'intermediate' },
			],
		},
		posted_at: '2024-01-25',
	},
	{
		id: '5',
		title: 'Machine Learning Engineer',
		department: 'AI/ML',
		location: 'Remote',
		type: 'Full-time',
		description: 'Develop and deploy ML models that power our intelligent hiring platform.',
		requirements: {
			skills: [
				{ name: 'Python', level: 'senior' },
				{ name: 'PyTorch', level: 'senior' },
				{ name: 'NLP', level: 'intermediate' },
			],
		},
		posted_at: '2024-01-28',
	},
];

const mockOrganization = {
	name: 'EvidentHire',
	description: 'We are building the future of hiring with AI-powered interview insights.',
	culture: 'Innovation, transparency, and a deep commitment to eliminating bias in hiring.',
	benefits: [
		'Competitive Salary',
		'Unlimited PTO',
		'Remote-First',
		'Health Insurance',
		'Learning Budget',
		'Stock Options',
	],
};

interface Position {
	id: string;
	title: string;
	department: string;
	location: string;
	type: string;
	description: string;
	requirements: {
		skills: { name: string; level: string }[];
	};
	posted_at: string;
}

export default function CareersPage({ params }: { params: Promise<{ orgSlug: string }> }) {
	const [positions, setPositions] = useState<Position[]>(mockPositions);
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedDepartment, setSelectedDepartment] = useState('All');
	const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);

	const departments = ['All', ...new Set(mockPositions.map((p) => p.department))];

	const filteredPositions = positions.filter((pos) => {
		const matchesSearch =
			pos.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
			pos.description.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesDepartment = selectedDepartment === 'All' || pos.department === selectedDepartment;
		return matchesSearch && matchesDepartment;
	});

	const handleApply = (position: Position) => {
		setSelectedPosition(position);
		setIsModalOpen(true);
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffTime = Math.abs(now.getTime() - date.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays === 1) return '1 day ago';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		return `${Math.floor(diffDays / 30)} months ago`;
	};

	const getDepartmentColor = (department: string) => {
		const colors: Record<string, string> = {
			Engineering: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
			Design: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
			'AI/ML': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
			Marketing: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
			Sales: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
		};
		return colors[department] || 'bg-slate-500/10 text-slate-500 border-slate-500/20';
	};

	return (
		<div className='min-h-screen bg-slate-50 dark:bg-slate-950'>
			{/* Navbar */}
			<nav className='sticky top-0 z-50 w-full border-b border-white/10 bg-slate-900/95 backdrop-blur-md'>
				<div className='mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8'>
					<div className='flex items-center gap-2'>
						<div className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20'>
							<Bot className='h-5 w-5 text-white' />
						</div>
						<span className='text-xl font-bold tracking-tight text-white'>{mockOrganization.name}</span>
						<span className='ml-2 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-400 border border-orange-500/20'>
							Careers
						</span>
					</div>
					<Link
						href='/'
						className='text-sm font-medium text-slate-300 hover:text-white transition-colors'>
						← Back to Home
					</Link>
				</div>
			</nav>

			{/* Hero Section */}
			<section className='relative overflow-hidden bg-slate-900 pt-16 pb-24'>
				{/* Animated Background */}
				<div className='absolute inset-0 overflow-hidden'>
					<div className='absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse'></div>
					<div
						className='absolute top-0 -right-4 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse'
						style={{ animationDelay: '1s' }}></div>
					<div
						className='absolute -bottom-8 left-1/2 w-96 h-96 bg-teal-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse'
						style={{ animationDelay: '2s' }}></div>
				</div>

				<div className='relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center'>
					<div className='inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 mb-6 backdrop-blur-sm'>
						<Sparkles className='h-4 w-4 text-orange-400 mr-2' />
						<span className='text-sm font-medium text-orange-400'>We&apos;re Hiring!</span>
					</div>

					<h1 className='mx-auto max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl'>
						Join Us in Building the{' '}
						<span className='text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500'>
							Future of Hiring
						</span>
					</h1>

					<p className='mx-auto mt-6 max-w-2xl text-lg text-slate-300'>
						{mockOrganization.description} Join our team and help us revolutionize how companies find and hire the best
						talent.
					</p>

					{/* Stats */}
					<div className='mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 max-w-3xl mx-auto'>
						<div className='rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm p-4'>
							<div className='text-2xl font-bold text-white'>{positions.length}</div>
							<div className='text-sm text-slate-400'>Open Positions</div>
						</div>
						<div className='rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm p-4'>
							<div className='text-2xl font-bold text-white'>50+</div>
							<div className='text-sm text-slate-400'>Team Members</div>
						</div>
						<div className='rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm p-4'>
							<div className='text-2xl font-bold text-white'>12</div>
							<div className='text-sm text-slate-400'>Countries</div>
						</div>
						<div className='rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm p-4'>
							<div className='text-2xl font-bold text-white'>4.8</div>
							<div className='text-sm text-slate-400 flex items-center justify-center gap-1'>
								<Star className='h-3 w-3 text-yellow-400 fill-yellow-400' />
								Glassdoor
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Benefits Section */}
			<section className='bg-white dark:bg-slate-900 py-16 border-b border-slate-200 dark:border-slate-800'>
				<div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
					<div className='text-center mb-10'>
						<h2 className='text-2xl font-bold text-slate-900 dark:text-white'>Why Join Us?</h2>
						<p className='mt-2 text-slate-600 dark:text-slate-400'>Perks and benefits that matter</p>
					</div>
					<div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4'>
						{mockOrganization.benefits.map((benefit, i) => (
							<div
								key={i}
								className='group flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all duration-300'>
								<Zap className='h-6 w-6 text-orange-500 mb-2 group-hover:scale-110 transition-transform' />
								<span className='text-sm font-medium text-slate-700 dark:text-slate-300 text-center'>{benefit}</span>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Positions Section */}
			<section className='py-16'>
				<div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
					{/* Section Header */}
					<div className='flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10'>
						<div>
							<h2 className='text-3xl font-bold text-slate-900 dark:text-white'>Open Positions</h2>
							<p className='mt-2 text-slate-600 dark:text-slate-400'>Find your next opportunity and grow with us</p>
						</div>

						{/* Filters */}
						<div className='flex flex-col sm:flex-row gap-4'>
							{/* Search */}
							<div className='relative'>
								<Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
								<input
									type='text'
									placeholder='Search positions...'
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className='w-full sm:w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder-slate-500 transition-all focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20'
								/>
							</div>

							{/* Department Filter */}
							<div className='flex gap-2 flex-wrap'>
								{departments.map((dept) => (
									<button
										key={dept}
										onClick={() => setSelectedDepartment(dept)}
										className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
											selectedDepartment === dept
												? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
												: 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-orange-500/50'
										}`}>
										{dept}
									</button>
								))}
							</div>
						</div>
					</div>

					{/* Positions Grid */}
					{filteredPositions.length === 0 ? (
						<div className='flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700'>
							<Briefcase className='h-12 w-12 text-slate-300 dark:text-slate-600 mb-4' />
							<h3 className='text-lg font-medium text-slate-900 dark:text-white'>No positions found</h3>
							<p className='mt-2 text-sm text-slate-500'>Try adjusting your search or filter criteria</p>
						</div>
					) : (
						<div className='grid gap-4'>
							{filteredPositions.map((position) => (
								<div
									key={position.id}
									className='group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/5 transition-all duration-300'>
									{/* Position Info */}
									<div className='flex-1'>
										<div className='flex items-center gap-3 mb-2'>
											<span
												className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getDepartmentColor(
													position.department
												)}`}>
												{position.department}
											</span>
											<span className='text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1'>
												<Clock className='h-3 w-3' />
												{formatDate(position.posted_at)}
											</span>
										</div>

										<h3 className='text-xl font-semibold text-slate-900 dark:text-white group-hover:text-orange-500 transition-colors'>
											{position.title}
										</h3>

										<p className='mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2'>
											{position.description}
										</p>

										<div className='mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400'>
											<span className='flex items-center gap-1.5'>
												<MapPin className='h-4 w-4' />
												{position.location}
											</span>
											<span className='flex items-center gap-1.5'>
												<Briefcase className='h-4 w-4' />
												{position.type}
											</span>
										</div>

										{/* Skills */}
										<div className='mt-4 flex flex-wrap gap-2'>
											{position.requirements.skills.map((skill, i) => (
												<span
													key={i}
													className='inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'>
													{skill.name}
												</span>
											))}
										</div>
									</div>

									{/* Apply Button */}
									<div className='flex-shrink-0'>
										<button
											onClick={() => handleApply(position)}
											className='group/btn inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:scale-105 active:scale-100'>
											Apply Now
											<ChevronRight className='h-4 w-4 transition-transform group-hover/btn:translate-x-0.5' />
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</section>

			{/* Footer */}
			<footer className='bg-slate-900 py-12 border-t border-slate-800'>
				<div className='mx-auto max-w-7xl px-6 lg:px-8'>
					<div className='flex flex-col items-center justify-between gap-6 sm:flex-row'>
						<div className='flex items-center gap-2'>
							<Bot className='h-6 w-6 text-orange-500' />
							<span className='text-lg font-bold text-white'>{mockOrganization.name}</span>
						</div>
						<p className='text-sm text-slate-400'>
							© {new Date().getFullYear()} {mockOrganization.name}. All rights reserved.
						</p>
						<div className='flex gap-6'>
							<a
								href='#'
								className='text-sm text-slate-400 hover:text-white transition-colors'>
								Privacy
							</a>
							<a
								href='#'
								className='text-sm text-slate-400 hover:text-white transition-colors'>
								Terms
							</a>
						</div>
					</div>
				</div>
			</footer>

			{/* Application Modal */}
			{isModalOpen && selectedPosition && (
				<ApplicationModal
					position={selectedPosition}
					onClose={() => {
						setIsModalOpen(false);
						setSelectedPosition(null);
					}}
				/>
			)}
		</div>
	);
}
