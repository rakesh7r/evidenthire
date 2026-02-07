'use client';

import { useState, useRef, useEffect, MouseEvent } from 'react';
import {
	MessageCircle,
	X,
	Send,
	Loader2,
	Sparkles,
	Users,
	Target,
	Lightbulb,
	RotateCcw,
	GripHorizontal,
} from 'lucide-react';
import api from '@/lib/api';

interface Message {
	role: 'user' | 'assistant';
	content: string;
	recommendations?: CandidateRecommendation[];
}

interface CandidateRecommendation {
	applicationId: string;
	name: string;
	email: string;
	overallScore: number | null;
	matchedSkills: string[];
	unmatchedSkills: string[];
	bonusSkills: string[];
	similarityScore: number;
}

interface RecruitingChatbotProps {
	positionId: string;
	positionTitle: string;
}

const quickActions = [
	{ id: 'top_candidates', label: 'Find Top Candidates', icon: Users },
	{ id: 'skill_gaps', label: 'Analyze Skill Gaps', icon: Target },
	{ id: 'compare_top', label: 'Compare Top 3', icon: Sparkles },
	{ id: 'hidden_gems', label: 'Find Hidden Gems', icon: Lightbulb },
];

export default function RecruitingChatbot({ positionId, positionTitle }: RecruitingChatbotProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [showQuickActions, setShowQuickActions] = useState(true);

	// Resizing state
	const [size, setSize] = useState({ width: 420, height: 600 });
	const [isResizing, setIsResizing] = useState(false);
	const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isOpen]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	// Resize logic
	useEffect(() => {
		const handleMouseMove = (e: globalThis.MouseEvent) => {
			if (!isResizing || !resizeRef.current) return;

			const deltaX = resizeRef.current.startX - e.clientX;
			const deltaY = resizeRef.current.startY - e.clientY;

			setSize({
				width: Math.max(350, Math.min(800, resizeRef.current.startWidth + deltaX)),
				height: Math.max(400, Math.min(800, resizeRef.current.startHeight + deltaY)),
			});
		};

		const handleMouseUp = () => {
			setIsResizing(false);
			resizeRef.current = null;
			document.body.style.cursor = 'default';
			document.body.style.userSelect = 'auto';
		};

		if (isResizing) {
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			document.body.style.cursor = 'nw-resize';
			document.body.style.userSelect = 'none';
		}

		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};
	}, [isResizing]);

	const startResize = (e: MouseEvent) => {
		e.preventDefault();
		setIsResizing(true);
		resizeRef.current = {
			startX: e.clientX,
			startY: e.clientY,
			startWidth: size.width,
			startHeight: size.height,
		};
	};

	const resetChat = () => {
		setMessages([]);
		setShowQuickActions(true);
		setInput('');
	};

	const sendMessage = async (messageText: string) => {
		if (!messageText.trim() || isLoading) return;

		const userMessage: Message = { role: 'user', content: messageText };
		setMessages((prev) => [...prev, userMessage]);
		setInput('');
		setIsLoading(true);
		setShowQuickActions(false);

		try {
			const conversationHistory = messages.map((m) => ({
				role: m.role,
				content: m.content,
			}));

			const { data } = await api.post('/chat', {
				message: messageText,
				positionId,
				conversationHistory,
			});

			const assistantMessage: Message = {
				role: 'assistant',
				content: data.message,
				recommendations: data.recommendations,
			};

			setMessages((prev) => [...prev, assistantMessage]);
		} catch (error) {
			console.error('Chat error:', error);
			setMessages((prev) => [
				...prev,
				{
					role: 'assistant',
					content: 'Sorry, I encountered an error. Please try again.',
				},
			]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleQuickAction = async (actionId: string) => {
		setIsLoading(true);
		setShowQuickActions(false);

		const action = quickActions.find((a) => a.id === actionId);
		if (action) {
			setMessages((prev) => [...prev, { role: 'user', content: action.label }]);
		}

		try {
			const { data } = await api.post('/chat/quick-actions', {
				action: actionId,
				positionId,
			});

			const assistantMessage: Message = {
				role: 'assistant',
				content: data.message,
				recommendations: data.recommendations,
			};

			setMessages((prev) => [...prev, assistantMessage]);
		} catch (error) {
			console.error('Quick action error:', error);
			setMessages((prev) => [
				...prev,
				{
					role: 'assistant',
					content: 'Sorry, I encountered an error. Please try again.',
				},
			]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		sendMessage(input);
	};

	return (
		<>
			{/* Chat Toggle Button */}
			<button
				onClick={() => setIsOpen(true)}
				className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-3 text-white shadow-lg hover:from-orange-600 hover:to-orange-700 transition-all hover:scale-105 ${
					isOpen ? 'hidden' : ''
				}`}>
				<Sparkles className='h-5 w-5' />
				<span className='font-medium'>AI Assistant</span>
			</button>

			{/* Chat Window */}
			{isOpen && (
				<div
					style={{ width: size.width, height: size.height }}
					className='fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300'>
					{/* Resize Handle */}
					<div
						onMouseDown={startResize}
						className='absolute top-0 left-0 p-2 cursor-nw-resize opacity-0 hover:opacity-100 transition-opacity z-50'
						title='Resize'>
						<GripHorizontal className='h-5 w-5 text-slate-400 rotate-45' />
					</div>

					{/* Header */}
					<div className='flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-orange-500 to-orange-600 rounded-t-2xl shrink-0'>
						<div className='flex items-center gap-3'>
							<div className='flex h-10 w-10 items-center justify-center rounded-full bg-white/20'>
								<Sparkles className='h-5 w-5 text-white' />
							</div>
							<div>
								<h3 className='font-semibold text-white'>AI Recruiting Assistant</h3>
								<p className='text-xs text-white/80 line-clamp-1'>{positionTitle}</p>
							</div>
						</div>
						<div className='flex items-center gap-1'>
							<button
								onClick={resetChat}
								className='rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors'
								title='Reset Chat'>
								<RotateCcw className='h-5 w-5' />
							</button>
							<button
								onClick={() => setIsOpen(false)}
								className='rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white transition-colors'>
								<X className='h-5 w-5' />
							</button>
						</div>
					</div>

					{/* Messages */}
					<div className='flex-1 overflow-y-auto p-4 space-y-4 min-h-0'>
						{messages.length === 0 && (
							<div className='text-center py-8'>
								<div className='flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-500/10 mx-auto mb-4'>
									<MessageCircle className='h-8 w-8 text-orange-500' />
								</div>
								<h4 className='font-semibold text-slate-900 dark:text-white mb-2'>How can I help you today?</h4>
								<p className='text-sm text-slate-500 mb-6'>
									Ask me anything about your candidates or use a quick action below.
								</p>
							</div>
						)}

						{/* Quick Actions */}
						{showQuickActions && messages.length === 0 && (
							<div className='grid grid-cols-2 gap-2'>
								{quickActions.map((action) => (
									<button
										key={action.id}
										onClick={() => handleQuickAction(action.id)}
										disabled={isLoading}
										className='flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left disabled:opacity-50'>
										<action.icon className='h-4 w-4 text-orange-500' />
										<span className='text-sm font-medium text-slate-700 dark:text-slate-300'>{action.label}</span>
									</button>
								))}
							</div>
						)}

						{/* Message List */}
						{messages.map((msg, idx) => (
							<div
								key={idx}
								className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
								<div
									className={`max-w-[85%] rounded-2xl px-4 py-3 ${
										msg.role === 'user'
											? 'bg-orange-500 text-white'
											: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
									}`}>
									<p className='text-sm whitespace-pre-wrap'>{msg.content}</p>

									{/* Candidate Recommendations / Citations */}
									{msg.recommendations && msg.recommendations.length > 0 && (
										<div className='mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2'>
											<p className='text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1'>
												<Users className='h-3 w-3' />
												Sources / Top Matches
											</p>
											{msg.recommendations.slice(0, 5).map((rec) => (
												<div
													key={rec.applicationId}
													className='flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-700/50 text-slate-900 dark:text-white border border-slate-100 dark:border-transparent'>
													<div>
														<p className='text-sm font-medium'>{rec.name}</p>
														<p className='text-xs text-slate-500'>{rec.email}</p>
													</div>
													<div className='text-right'>
														<span
															className={`text-xs font-bold px-2 py-1 rounded-full ${
																(rec.overallScore ?? 0) >= 80
																	? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
																	: (rec.overallScore ?? 0) >= 60
																	? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
																	: 'bg-slate-100 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
															}`}>
															{rec.overallScore ?? 'N/A'}%
														</span>
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							</div>
						))}

						{/* Loading indicator */}
						{isLoading && (
							<div className='flex justify-start'>
								<div className='bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-3'>
									<div className='flex items-center gap-2'>
										<Loader2 className='h-4 w-4 animate-spin text-orange-500' />
										<span className='text-sm text-slate-500'>Analyzing candidates...</span>
									</div>
								</div>
							</div>
						)}

						<div ref={messagesEndRef} />
					</div>

					{/* Input */}
					<form
						onSubmit={handleSubmit}
						className='shrink-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-b-2xl'>
						<div className='flex items-center gap-2'>
							<input
								ref={inputRef}
								type='text'
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder='Ask about candidates...'
								disabled={isLoading}
								className='flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none disabled:opacity-50'
							/>
							<button
								type='submit'
								disabled={!input.trim() || isLoading}
								className='flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
								title='Send Message'>
								<Send className='h-5 w-5' />
							</button>
						</div>
					</form>
				</div>
			)}
		</>
	);
}
