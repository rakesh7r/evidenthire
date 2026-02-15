'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';

import api from '@/lib/api';

interface Message {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: Date;
}

interface InterviewChatbotProps {
	interviewId?: string;
	candidateName?: string;
}

export default function InterviewChatbot({ interviewId, candidateName }: InterviewChatbotProps) {
	const initialMessage = interviewId
		? `Hello! I can answer questions about the interview with ${
				candidateName || 'the candidate'
		  }. Ask me anything about the transcript or evidence.`
		: 'Hello! I can help you analyze interviews, compare candidates, or suggest questions. What would you like to know?';

	const [messages, setMessages] = useState<Message[]>([
		{
			id: '1',
			role: 'assistant',
			content: initialMessage,
			timestamp: new Date(),
		},
	]);
	const [input, setInput] = useState('');
	const [isTyping, setIsTyping] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages, isTyping]);

	const handleSend = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!input.trim()) return;

		const userMsg: Message = {
			id: Date.now().toString(),
			role: 'user',
			content: input,
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMsg]);
		setInput('');
		setIsTyping(true);

		if (interviewId) {
			try {
				const { data } = await api.post(`/interviews/${interviewId}/chat`, {
					message: userMsg.content,
				});

				const aiMsg: Message = {
					id: (Date.now() + 1).toString(),
					role: 'assistant',
					content: data.response || "I couldn't generate a response.",
					timestamp: new Date(),
				};
				setMessages((prev) => [...prev, aiMsg]);
			} catch (err) {
				console.error('Chat error:', err);
				const errorMsg: Message = {
					id: (Date.now() + 1).toString(),
					role: 'assistant',
					content: 'Sorry, I encountered an error connecting to the server.',
					timestamp: new Date(),
				};
				setMessages((prev) => [...prev, errorMsg]);
			} finally {
				setIsTyping(false);
			}
		} else {
			// Mock AI response for generic mode (if kept)
			setTimeout(() => {
				const responses = [
					'Based on the transcripts, Sarah showed excellent command of React hooks but struggled slightly with system design concepts.',
					"I've analyzed the last 3 interviews. The strongest candidate for technical depth is Jessica, scoring 9/10 on the coding challenge.",
					"Here's a suggested follow-up question: 'Can you describe a situation where you had to optimize a slow-performing API endpoint?'",
					'The average sentiment across all interviews is positive. Candidate #2 had particularly high engagement metrics.',
				];
				const randomResponse = responses[Math.floor(Math.random() * responses.length)];

				const aiMsg: Message = {
					id: (Date.now() + 1).toString(),
					role: 'assistant',
					content: randomResponse,
					timestamp: new Date(),
				};
				setMessages((prev) => [...prev, aiMsg]);
				setIsTyping(false);
			}, 1500);
		}
	};

	return (
		<div className='flex flex-col h-[500px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm'>
			{/* Chat Header */}
			<div className='flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/20'>
				<div className='flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 shadow-md shadow-orange-500/20'>
					<Bot className='h-5 w-5 text-white' />
				</div>
				<div>
					<h3 className='font-semibold text-slate-900 dark:text-white text-sm'>Interview Assistant</h3>
					<p className='text-xs text-slate-500 flex items-center gap-1'>
						<span className='h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse' />
						Online • AI Powered
					</p>
				</div>
			</div>

			{/* Messages Area */}
			<div className='flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 dark:bg-slate-900/30'>
				{messages.map((msg) => (
					<div
						key={msg.id}
						className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
						<div
							className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
								msg.role === 'user'
									? 'bg-orange-600 text-white rounded-tr-none'
									: 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none'
							}`}>
							{msg.content}
							<div
								className={`mt-1 text-[10px] opacity-70 flex justify-end ${
									msg.role === 'user' ? 'text-white/80' : 'text-slate-400'
								}`}>
								{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
							</div>
						</div>
					</div>
				))}
				{isTyping && (
					<div className='flex justify-start'>
						<div className='max-w-[85%] rounded-2xl rounded-tl-none bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-4 py-3 shadow-sm'>
							<div className='flex gap-1'>
								<span
									className='h-2 w-2 rounded-full bg-slate-400 animate-bounce'
									style={{ animationDelay: '0ms' }}
								/>
								<span
									className='h-2 w-2 rounded-full bg-slate-400 animate-bounce'
									style={{ animationDelay: '150ms' }}
								/>
								<span
									className='h-2 w-2 rounded-full bg-slate-400 animate-bounce'
									style={{ animationDelay: '300ms' }}
								/>
							</div>
						</div>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Input Area */}
			<form
				onSubmit={handleSend}
				className='border-t border-slate-100 dark:border-slate-800 p-4 bg-white dark:bg-slate-900'>
				<div className='relative'>
					<input
						type='text'
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder='Ask about interviews...'
						className='w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-3 pl-4 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-all'
					/>
					<button
						type='submit'
						disabled={!input.trim()}
						className='absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-orange-600 hover:bg-orange-50 dark:text-orange-500 dark:hover:bg-orange-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'>
						<Send className='h-4 w-4' />
					</button>
				</div>
				<p className='mt-2 text-[10px] text-center text-slate-400 flex items-center justify-center gap-1'>
					<Sparkles className='h-3 w-3' />
					AI can make mistakes. Verify important info.
				</p>
			</form>
		</div>
	);
}
