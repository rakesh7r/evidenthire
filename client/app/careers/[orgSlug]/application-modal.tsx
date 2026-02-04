'use client';

import { useState, useRef } from 'react';
import { X, Upload, FileText, Loader2, CheckCircle, User, Mail, Briefcase, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Position {
	id: string;
	title: string;
	department: string;
	location: string;
	type: string;
	description: string;
	job_description?: string;
	requirements: {
		skills: { name: string; level: string }[];
	};
}

interface ApplicationModalProps {
	position: Position;
	onClose: () => void;
}

export default function ApplicationModal({ position, onClose }: ApplicationModalProps) {
	const [formData, setFormData] = useState({
		name: '',
		email: '',
	});
	const [resume, setResume] = useState<File | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [dragActive, setDragActive] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const validateForm = () => {
		const newErrors: Record<string, string> = {};

		if (!formData.name.trim()) {
			newErrors.name = 'Name is required';
		}

		if (!formData.email.trim()) {
			newErrors.email = 'Email is required';
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
			newErrors.email = 'Please enter a valid email address';
		}

		if (!resume) {
			newErrors.resume = 'Resume is required';
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm()) {
			return;
		}

		setIsSubmitting(true);

		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 2000));

		setIsSubmitting(false);
		setIsSuccess(true);

		// Show success message
		toast.success('Application submitted successfully!', {
			description: `We'll review your application for ${position.title} and get back to you soon.`,
		});

		// Close modal after brief delay to show success state
		setTimeout(() => {
			onClose();
		}, 2000);
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			if (file.size > 10 * 1024 * 1024) {
				setErrors({ ...errors, resume: 'File size must be less than 10MB' });
				return;
			}
			if (
				![
					'application/pdf',
					'application/msword',
					'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				].includes(file.type)
			) {
				setErrors({ ...errors, resume: 'Please upload a PDF or Word document' });
				return;
			}
			setResume(file);
			setErrors({ ...errors, resume: '' });
		}
	};

	const handleDrag = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === 'dragenter' || e.type === 'dragover') {
			setDragActive(true);
		} else if (e.type === 'dragleave') {
			setDragActive(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);

		const file = e.dataTransfer.files?.[0];
		if (file) {
			if (file.size > 10 * 1024 * 1024) {
				setErrors({ ...errors, resume: 'File size must be less than 10MB' });
				return;
			}
			if (
				![
					'application/pdf',
					'application/msword',
					'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				].includes(file.type)
			) {
				setErrors({ ...errors, resume: 'Please upload a PDF or Word document' });
				return;
			}
			setResume(file);
			setErrors({ ...errors, resume: '' });
		}
	};

	const removeResume = () => {
		setResume(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
			{/* Backdrop */}
			<div
				className='absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity'
				onClick={onClose}
			/>

			{/* Modal */}
			<div className='relative w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col'>
				{/* Success State */}
				{isSuccess ? (
					<div className='flex flex-col items-center justify-center p-12'>
						<div className='flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/25 mb-6 animate-in zoom-in duration-300'>
							<CheckCircle className='h-10 w-10 text-white' />
						</div>
						<h3 className='text-2xl font-bold text-slate-900 dark:text-white mb-2'>Application Submitted!</h3>
						<p className='text-center text-slate-600 dark:text-slate-400'>
							Thank you for applying to{' '}
							<span className='font-medium text-slate-900 dark:text-white'>{position.title}</span>. We&apos;ll be in
							touch soon!
						</p>
					</div>
				) : (
					<>
						{/* Header */}
						<div className='relative border-b border-slate-200 dark:border-slate-800 bg-linear-to-r from-orange-500/10 to-purple-500/10 p-6 shrink-0'>
							<button
								onClick={onClose}
								className='absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors'>
								<X className='h-5 w-5' />
							</button>

							<div className='flex items-center gap-3 mb-3'>
								<div className='flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/25'>
									<Briefcase className='h-6 w-6 text-white' />
								</div>
								<div>
									<span className='text-xs font-medium text-orange-500 uppercase tracking-wider'>Apply for</span>
									<h2 className='text-xl font-bold text-slate-900 dark:text-white'>{position.title}</h2>
								</div>
							</div>

							<div className='flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400'>
								<span className='inline-flex items-center gap-1'>
									<span className='h-1.5 w-1.5 rounded-full bg-emerald-500'></span>
									{position.department}
								</span>
								<span>•</span>
								<span>{position.location}</span>
								<span>•</span>
								<span>{position.type}</span>
							</div>
						</div>

						{/* Scrollable Content: Job Description + Form */}
						<div className='flex-1 overflow-y-auto'>
							{/* Job Description Section */}
							<div className='p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'>
								<h3 className='text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2'>
									<FileText className='h-4 w-4 text-orange-500' />
									Job Description
								</h3>
								<div className='prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-sans'>
									{position.job_description || position.description}
								</div>
							</div>

							{/* Form */}
							<form
								onSubmit={handleSubmit}
								className='p-6 space-y-5'>
								{/* Name Input */}
								<div>
									<label className='flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2'>
										<User className='h-4 w-4' />
										Full Name
									</label>
									<input
										type='text'
										value={formData.name}
										onChange={(e) => setFormData({ ...formData, name: e.target.value })}
										placeholder='John Doe'
										className={`w-full rounded-xl border ${
											errors.name
												? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
												: 'border-slate-200 dark:border-slate-700 focus:border-orange-500 focus:ring-orange-500/20'
										} bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 transition-all focus:outline-none focus:ring-2`}
									/>
									{errors.name && (
										<p className='mt-1.5 text-xs text-red-500 flex items-center gap-1'>
											<AlertCircle className='h-3 w-3' />
											{errors.name}
										</p>
									)}
								</div>

								{/* Email Input */}
								<div>
									<label className='flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2'>
										<Mail className='h-4 w-4' />
										Email Address
									</label>
									<input
										type='email'
										value={formData.email}
										onChange={(e) => setFormData({ ...formData, email: e.target.value })}
										placeholder='john@example.com'
										className={`w-full rounded-xl border ${
											errors.email
												? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
												: 'border-slate-200 dark:border-slate-700 focus:border-orange-500 focus:ring-orange-500/20'
										} bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 transition-all focus:outline-none focus:ring-2`}
									/>
									{errors.email && (
										<p className='mt-1.5 text-xs text-red-500 flex items-center gap-1'>
											<AlertCircle className='h-3 w-3' />
											{errors.email}
										</p>
									)}
								</div>

								{/* Resume Upload */}
								<div>
									<label className='flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2'>
										<FileText className='h-4 w-4' />
										Resume/CV
									</label>

									{resume ? (
										<div className='flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4'>
											<div className='flex items-center gap-3'>
												<div className='flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10'>
													<FileText className='h-5 w-5 text-emerald-500' />
												</div>
												<div>
													<p className='text-sm font-medium text-slate-900 dark:text-white truncate max-w-[200px]'>
														{resume.name}
													</p>
													<p className='text-xs text-slate-500'>{(resume.size / 1024).toFixed(1)} KB</p>
												</div>
											</div>
											<button
												type='button'
												onClick={removeResume}
												className='rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-500 transition-colors'>
												<X className='h-4 w-4' />
											</button>
										</div>
									) : (
										<div
											onDragEnter={handleDrag}
											onDragLeave={handleDrag}
											onDragOver={handleDrag}
											onDrop={handleDrop}
											onClick={() => fileInputRef.current?.click()}
											className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all ${
												dragActive
													? 'border-orange-500 bg-orange-500/5'
													: errors.resume
													? 'border-red-500 bg-red-500/5'
													: 'border-slate-200 dark:border-slate-700 hover:border-orange-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
											}`}>
											<input
												ref={fileInputRef}
												type='file'
												accept='.pdf,.doc,.docx'
												onChange={handleFileChange}
												className='hidden'
											/>
											<div
												className={`flex h-12 w-12 items-center justify-center rounded-xl ${
													dragActive ? 'bg-orange-500/10' : 'bg-slate-100 dark:bg-slate-800'
												} mb-3 transition-colors`}>
												<Upload className={`h-6 w-6 ${dragActive ? 'text-orange-500' : 'text-slate-400'}`} />
											</div>
											<p className='text-sm text-slate-600 dark:text-slate-400 text-center'>
												<span className='font-medium text-orange-500'>Click to upload</span> or drag and drop
											</p>
											<p className='text-xs text-slate-400 mt-1'>PDF, DOC, or DOCX (max 10MB)</p>
										</div>
									)}
									{errors.resume && (
										<p className='mt-1.5 text-xs text-red-500 flex items-center gap-1'>
											<AlertCircle className='h-3 w-3' />
											{errors.resume}
										</p>
									)}
								</div>

								{/* Submit Button */}
								<button
									type='submit'
									disabled={isSubmitting}
									className='w-full flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-orange-500 to-orange-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:from-orange-600 hover:to-orange-700 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:shadow-orange-500/25'>
									{isSubmitting ? (
										<>
											<Loader2 className='h-5 w-5 animate-spin' />
											Submitting Application...
										</>
									) : (
										<>
											<Sparkles className='h-5 w-5' />
											Submit Application
										</>
									)}
								</button>

								{/* Privacy Note */}
								<p className='text-xs text-center text-slate-500 dark:text-slate-400'>
									By submitting this application, you agree to our{' '}
									<a
										href='#'
										className='text-orange-500 hover:underline'>
										Privacy Policy
									</a>{' '}
									and{' '}
									<a
										href='#'
										className='text-orange-500 hover:underline'>
										Terms of Service
									</a>
									.
								</p>
							</form>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
