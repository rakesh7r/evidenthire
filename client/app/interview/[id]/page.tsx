'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
	Video,
	Mic,
	MicOff,
	VideoOff,
	Settings,
	Briefcase,
	Building2,
	Clock,
	Calendar,
	Loader2,
	AlertCircle,
	ArrowRight,
	XCircle,
	Timer,
	UserCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import InterviewRoom from './room';
import { createLocalAudioTrack, createLocalVideoTrack, LocalAudioTrack, LocalVideoTrack } from 'livekit-client';
import { useRef } from 'react';
import { formatDate, formatTime } from '@/utils/date';

interface AccessConfig {
	earlyJoinMinutes: number;
	lateGraceMinutes: number;
}

interface StatusSummary {
	status: string;
	canJoin: boolean;
	message: string;
	waitingRoom?: {
		candidateWaiting: boolean;
		waitingSince: string | null;
	};
	timing?: {
		scheduledStart: string;
		joinWindowStart: string;
		expiryTime: string;
		durationMs: number | null;
	};
}

interface PublicInterview {
	id: string;
	candidate_name: string;
	position_title: string;
	organization_name: string;
	scheduled_start: string;
	status: string;
	round_title?: string;
	round_type?: string;
	accessConfig?: AccessConfig;
	statusSummary?: StatusSummary;
}

type AccessStatus = 'loading' | 'too_early' | 'allowed' | 'waiting_room' | 'expired' | 'completed' | 'cancelled';

export default function JoinInterviewPage() {
	const { id } = useParams();
	const searchParams = useSearchParams();
	const [interview, setInterview] = useState<PublicInterview | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Access control states
	const [accessStatus, setAccessStatus] = useState<AccessStatus>('loading');
	const [accessMessage, setAccessMessage] = useState<string>('');
	const [joinWindowStart, setJoinWindowStart] = useState<Date | null>(null);
	const [timeUntilOpen, setTimeUntilOpen] = useState<string>('');
	const [isWaitingRoom, setIsWaitingRoom] = useState(false);
	const [isPollingWaitingRoom, setIsPollingWaitingRoom] = useState(false);

	// Media states
	const [isMicOn, setIsMicOn] = useState(true);
	const [isVideoOn, setIsVideoOn] = useState(true);
	const [token, setToken] = useState<string | null>(null);
	const [isJoined, setIsJoined] = useState(false);
	const [isJoining, setIsJoining] = useState(false);

	// Local tracks for preview
	const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
	const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);

	const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;
	const isInterviewer = searchParams.get('isInterviewer') === 'true';

	// Fetch interview details
	useEffect(() => {
		if (!id) return;

		async function fetchInterview() {
			try {
				const res = await api.get(`/interviews/public/${id}`);
				setInterview(res.data);

				// Check status from response
				const statusSummary = res.data.statusSummary;
				if (statusSummary) {
					updateAccessStatus(statusSummary, res.data.accessConfig);
				} else {
					setAccessStatus('allowed');
				}

				setError(null);
			} catch (err: any) {
				console.error('Failed to fetch interview:', err);
				setError(err.response?.data?.error || 'Failed to load interview details. Please check the link and try again.');
			} finally {
				setIsLoading(false);
			}
		}

		fetchInterview();
	}, [id]);

	// Update access status based on server response
	const updateAccessStatus = (statusSummary: StatusSummary, accessConfig?: AccessConfig) => {
		switch (statusSummary.status) {
			case 'completed':
				setAccessStatus('completed');
				setAccessMessage('This interview has already ended.');
				break;
			case 'cancelled':
				setAccessStatus('cancelled');
				setAccessMessage('This interview has been cancelled.');
				break;
			case 'no_show':
			case 'expired':
				setAccessStatus('expired');
				setAccessMessage('This interview has expired. No participants joined within the allowed time window.');
				break;
			default:
				if (!statusSummary.canJoin && statusSummary.timing) {
					// Check if too early
					const now = new Date();
					const windowStart = new Date(statusSummary.timing.joinWindowStart);
					if (now < windowStart) {
						setAccessStatus('too_early');
						setJoinWindowStart(windowStart);
						setAccessMessage(
							`The interview lobby opens ${accessConfig?.earlyJoinMinutes || 30} minutes before the scheduled time.`
						);
					} else {
						setAccessStatus('allowed');
					}
				} else {
					setAccessStatus('allowed');
				}
		}
	};

	// Countdown timer for "too early" status
	useEffect(() => {
		if (accessStatus !== 'too_early' || !joinWindowStart) return;

		const updateCountdown = () => {
			const now = new Date();
			const diff = joinWindowStart.getTime() - now.getTime();

			if (diff <= 0) {
				setAccessStatus('allowed');
				setTimeUntilOpen('');
				return;
			}

			const hours = Math.floor(diff / 3600000);
			const minutes = Math.floor((diff % 3600000) / 60000);
			const seconds = Math.floor((diff % 60000) / 1000);

			if (hours > 0) {
				setTimeUntilOpen(`${hours}h ${minutes}m ${seconds}s`);
			} else if (minutes > 0) {
				setTimeUntilOpen(`${minutes}m ${seconds}s`);
			} else {
				setTimeUntilOpen(`${seconds}s`);
			}
		};

		updateCountdown();
		const interval = setInterval(updateCountdown, 1000);

		return () => clearInterval(interval);
	}, [accessStatus, joinWindowStart]);

	// Poll for waiting room admission (candidates only)
	const pollWaitingRoom = useCallback(async () => {
		if (!id || !isWaitingRoom) return;

		try {
			const res = await api.get(`/interviews/public/${id}/waiting-status`);
			if (res.data.isAdmitted) {
				setIsWaitingRoom(false);
				setIsPollingWaitingRoom(false);
				toast.success('You have been admitted! Joining the interview...');
				// Retry join after admission
				handleJoin();
			}
		} catch (err) {
			console.error('Error polling waiting room:', err);
		}
	}, [id, isWaitingRoom]);

	useEffect(() => {
		if (!isWaitingRoom || !isPollingWaitingRoom) return;

		const interval = setInterval(pollWaitingRoom, 3000); // Poll every 3 seconds
		return () => clearInterval(interval);
	}, [isWaitingRoom, isPollingWaitingRoom, pollWaitingRoom]);

	// Initialize local tracks
	useEffect(() => {
		async function initTracks() {
			try {
				const vTrack = await createLocalVideoTrack({
					resolution: { width: 1280, height: 720 },
				});
				setLocalVideoTrack(vTrack);

				const aTrack = await createLocalAudioTrack();
				setLocalAudioTrack(aTrack);
			} catch (e) {
				console.error('Failed to get local tracks:', e);
				toast.error('Could not access camera or microphone. Please check permissions.');
				setIsVideoOn(false);
				setIsMicOn(false);
			}
		}

		if (!isJoined && !isLoading && interview && accessStatus === 'allowed') {
			initTracks();
		}

		return () => {
			if (!isJoined) {
				localVideoTrack?.stop();
				localAudioTrack?.stop();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLoading, isJoined, accessStatus]);

	// Attach video to element
	useEffect(() => {
		if (videoRef.current && localVideoTrack) {
			localVideoTrack.attach(videoRef.current);
		}
		return () => {
			if (localVideoTrack) {
				localVideoTrack.detach();
			}
		};
	}, [localVideoTrack]);

	const toggleMic = () => {
		if (localAudioTrack) {
			const newState = !isMicOn;
			if (newState) {
				localAudioTrack.unmute();
			} else {
				localAudioTrack.mute();
			}
			setIsMicOn(newState);
		}
	};

	const toggleVideo = async () => {
		if (localVideoTrack) {
			const newState = !isVideoOn;
			if (newState) {
				await localVideoTrack.unmute();
			} else {
				await localVideoTrack.mute();
			}
			setIsVideoOn(newState);
		}
	};

	const handleJoin = async () => {
		if (!interview || !id) return;
		setIsJoining(true);

		try {
			const participantName = interview.candidate_name || 'Guest User';
			const identity = `user-${Math.random().toString(36).substr(2, 9)}`;

			const email = searchParams.get('email');
			const candidateAccessKey = searchParams.get('candidate_access_key');

			const res = await api.get(`/interviews/public/${id}/token`, {
				params: {
					name: participantName,
					identity: identity,
					email: email,
					candidate_access_key: candidateAccessKey,
				},
			});

			// Check if put in waiting room
			if (res.data.waitingRoom) {
				setIsWaitingRoom(true);
				setIsPollingWaitingRoom(true);
				toast.info(res.data.message || 'Waiting for the interviewer to admit you...');
				setIsJoining(false);
				return;
			}

			setToken(res.data.token);
			setIsJoined(true);
		} catch (err: any) {
			console.error('Failed to get token:', err);

			// Handle specific error codes
			if (err.response?.data?.code) {
				switch (err.response.data.code) {
					case 'TOO_EARLY':
						setAccessStatus('too_early');
						if (err.response.data.joinWindowStart) {
							setJoinWindowStart(new Date(err.response.data.joinWindowStart));
						}
						setAccessMessage(err.response.data.error);
						break;
					case 'INTERVIEW_EXPIRED':
					case 'INTERVIEW_NO_SHOW':
						setAccessStatus('expired');
						setAccessMessage(err.response.data.error);
						break;
					case 'INTERVIEW_COMPLETED':
						setAccessStatus('completed');
						setAccessMessage(err.response.data.error);
						break;
					case 'INTERVIEW_CANCELLED':
						setAccessStatus('cancelled');
						setAccessMessage(err.response.data.error);
						break;
					default:
						toast.error(err.response?.data?.error || 'Failed to join the room. Please try again.');
				}
			} else {
				toast.error(err.response?.data?.error || 'Failed to join the room. Please try again.');
			}
		} finally {
			setIsJoining(false);
		}
	};

	const handleLeave = () => {
		setIsJoined(false);
		setToken(null);
		toast.info('You have left the interview.');
	};

	// Render joined state
	if (isJoined && token && LIVEKIT_URL) {
		return (
			<InterviewRoom
				token={token}
				serverUrl={LIVEKIT_URL}
				onLeave={handleLeave}
				micEnabled={isMicOn}
				camEnabled={isVideoOn}
				interviewId={id as string}
				isInterviewer={isInterviewer}
				roundTitle={interview?.round_title}
			/>
		);
	}

	// Render loading state
	if (isLoading) {
		return (
			<div className='min-h-screen bg-slate-950 flex flex-col items-center justify-center'>
				<Loader2 className='h-12 w-12 text-orange-500 animate-spin mb-4' />
				<p className='text-slate-400 font-medium'>Preparing your lobby...</p>
			</div>
		);
	}

	// Render error state
	if (error || !interview) {
		return (
			<div className='min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4'>
				<div className='max-w-md w-full text-center space-y-6'>
					<div className='mx-auto h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20'>
						<AlertCircle className='h-10 w-10 text-red-500' />
					</div>
					<div className='space-y-2'>
						<h1 className='text-2xl font-bold text-white'>Couldn't load interview</h1>
						<p className='text-slate-400'>{error || 'The interview link is invalid or has expired.'}</p>
					</div>
				</div>
			</div>
		);
	}

	// Render access denied states
	if (accessStatus === 'expired' || accessStatus === 'completed' || accessStatus === 'cancelled') {
		const icons = {
			expired: XCircle,
			completed: UserCheck,
			cancelled: XCircle,
		};
		const colors = {
			expired: 'red',
			completed: 'blue',
			cancelled: 'yellow',
		};
		const Icon = icons[accessStatus];
		const color = colors[accessStatus];

		return (
			<div className='min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4'>
				<div className='max-w-md w-full text-center space-y-6'>
					<div
						className={`mx-auto h-20 w-20 rounded-full bg-${color}-500/10 flex items-center justify-center border border-${color}-500/20`}>
						<Icon className={`h-10 w-10 text-${color}-500`} />
					</div>
					<div className='space-y-2'>
						<h1 className='text-2xl font-bold text-white'>
							{accessStatus === 'completed'
								? 'Interview Completed'
								: accessStatus === 'cancelled'
								? 'Interview Cancelled'
								: 'Interview Expired'}
						</h1>
						<p className='text-slate-400'>{accessMessage}</p>
					</div>
					{/* Show interview details */}
					<div className='mt-6 p-4 rounded-xl bg-white/5 border border-white/10'>
						<div className='flex items-center gap-3 text-sm text-slate-400'>
							<Briefcase className='h-4 w-4' />
							<span>{interview.position_title}</span>
						</div>
						<div className='flex items-center gap-3 text-sm text-slate-400 mt-2'>
							<Calendar className='h-4 w-4' />
							<span>{formatDate(interview.scheduled_start)}</span>
							<Clock className='h-4 w-4 ml-2' />
							<span>{formatTime(interview.scheduled_start)}</span>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Render "too early" state
	if (accessStatus === 'too_early') {
		return (
			<div className='min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4'>
				<div className='max-w-md w-full text-center space-y-6'>
					<div className='mx-auto h-20 w-20 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20'>
						<Timer className='h-10 w-10 text-orange-500' />
					</div>
					<div className='space-y-2'>
						<h1 className='text-2xl font-bold text-white'>You're early!</h1>
						<p className='text-slate-400'>{accessMessage}</p>
					</div>
					{/* Countdown */}
					{timeUntilOpen && (
						<div className='mt-6 p-6 rounded-xl bg-white/5 border border-white/10'>
							<p className='text-sm text-slate-500 mb-2'>Lobby opens in</p>
							<p className='text-4xl font-bold text-orange-500 font-mono'>{timeUntilOpen}</p>
						</div>
					)}
					{/* Interview details */}
					<div className='mt-4 p-4 rounded-xl bg-white/5 border border-white/10'>
						<div className='flex items-center justify-center gap-3 text-sm text-slate-400'>
							<Briefcase className='h-4 w-4' />
							<span>{interview.position_title}</span>
						</div>
						<div className='flex items-center justify-center gap-3 text-sm text-slate-400 mt-2'>
							<Calendar className='h-4 w-4' />
							<span>{formatDate(interview.scheduled_start)}</span>
							<Clock className='h-4 w-4 ml-2' />
							<span>{formatTime(interview.scheduled_start)}</span>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Render waiting room state
	if (isWaitingRoom) {
		return (
			<div className='min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4'>
				<div className='max-w-md w-full text-center space-y-6'>
					<div className='mx-auto h-20 w-20 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20'>
						<Loader2 className='h-10 w-10 text-blue-500 animate-spin' />
					</div>
					<div className='space-y-2'>
						<h1 className='text-2xl font-bold text-white'>Waiting Room</h1>
						<p className='text-slate-400'>Please wait for the interviewer to admit you to the interview.</p>
					</div>
					{/* Pulse animation */}
					<div className='flex justify-center mt-6'>
						<div className='flex items-center gap-2'>
							<span className='h-2 w-2 rounded-full bg-blue-500 animate-pulse' />
							<span className='h-2 w-2 rounded-full bg-blue-500 animate-pulse delay-100' />
							<span className='h-2 w-2 rounded-full bg-blue-500 animate-pulse delay-200' />
						</div>
					</div>
					{/* Interview details */}
					<div className='mt-4 p-4 rounded-xl bg-white/5 border border-white/10'>
						<div className='flex items-center justify-center gap-3 text-sm text-slate-400'>
							<Briefcase className='h-4 w-4' />
							<span>{interview.position_title}</span>
						</div>
						<div className='flex items-center justify-center gap-3 text-sm text-slate-400 mt-2'>
							<Building2 className='h-4 w-4' />
							<span>{interview.organization_name}</span>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Render main lobby
	return (
		<div className='min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden'>
			{/* Background Decorations */}
			<div className='absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10'>
				<div className='absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 rounded-full blur-[120px]' />
				<div className='absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]' />
			</div>

			<main className='max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center'>
				{/* Left Side: Video Preview & Controls */}
				<div className='lg:col-span-7 space-y-6'>
					<div className='relative aspect-video rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex items-center justify-center group'>
						{isVideoOn ? (
							<div className='absolute inset-0 bg-slate-800 flex items-center justify-center overflow-hidden'>
								<video
									ref={videoRef}
									className='h-full w-full object-cover -scale-x-100'
									autoPlay
									playsInline
									muted
								/>
							</div>
						) : (
							<div className='absolute inset-0 bg-slate-950 flex items-center justify-center'>
								<VideoOff className='h-20 w-20 text-slate-800' />
								<div className='absolute inset-0 bg-linear-to-br from-transparent to-black/40' />
							</div>
						)}

						{/* Overlay Controls */}
						<div className='absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 transition-transform group-hover:scale-105'>
							<button
								onClick={toggleMic}
								className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${
									isMicOn
										? 'bg-slate-800/80 hover:bg-slate-700 text-white'
										: 'bg-red-500/80 hover:bg-red-600 text-white'
								} backdrop-blur-md border border-white/10 shadow-lg`}>
								{isMicOn ? <Mic className='h-6 w-6' /> : <MicOff className='h-6 w-6' />}
							</button>
							<button
								onClick={toggleVideo}
								className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all ${
									isVideoOn
										? 'bg-slate-800/80 hover:bg-slate-700 text-white'
										: 'bg-red-500/80 hover:bg-red-600 text-white'
								} backdrop-blur-md border border-white/10 shadow-lg`}>
								{isVideoOn ? <Video className='h-6 w-6' /> : <VideoOff className='h-6 w-6' />}
							</button>
							<button className='h-14 w-14 rounded-2xl bg-slate-800/80 flex items-center justify-center hover:bg-slate-700 text-white backdrop-blur-md border border-white/10 shadow-lg transition-all'>
								<Settings className='h-6 w-6' />
							</button>
						</div>
					</div>
				</div>

				{/* Right Side: Interview Details & Join */}
				<div className='lg:col-span-5 space-y-8'>
					<div className='space-y-2'>
						<div className='inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-400'>
							<span className='h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse' />
							Interview Waiting Lobby
						</div>
						<h1 className='text-4xl font-extrabold text-white tracking-tight'>Ready to start?</h1>
						<p className='text-lg text-slate-400 leading-relaxed'>
							Check your audio and video before jumping into the conversation.
						</p>
					</div>

					<div className='space-y-4 p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl'>
						<div className='flex items-center gap-4'>
							<div className='h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700'>
								<Briefcase className='h-6 w-6 text-orange-500' />
							</div>
							<div>
								<p className='text-xs font-medium text-slate-500 uppercase tracking-wider'>Position</p>
								<h3 className='text-xl font-bold text-white'>{interview.position_title}</h3>
							</div>
						</div>

						<div className='flex items-center gap-4'>
							<div className='h-12 w-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700'>
								<Building2 className='h-6 w-6 text-blue-500' />
							</div>
							<div>
								<p className='text-xs font-medium text-slate-500 uppercase tracking-wider'>Organization</p>
								<h3 className='text-lg font-semibold text-slate-200'>{interview.organization_name}</h3>
							</div>
						</div>

						<div className='grid grid-cols-2 gap-4 mt-2 pt-4 border-t border-white/10'>
							<div className='flex items-center gap-3'>
								<Calendar className='h-4 w-4 text-slate-500' />
								<span className='text-sm text-slate-300'>{formatDate(interview.scheduled_start)}</span>
							</div>
							<div className='flex items-center gap-3'>
								<Clock className='h-4 w-4 text-slate-500' />
								<span className='text-sm text-slate-300'>{formatTime(interview.scheduled_start)}</span>
							</div>
						</div>
					</div>

					<button
						onClick={handleJoin}
						disabled={isJoining}
						className='w-full h-16 group relative flex items-center justify-center gap-3 rounded-2xl bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 disabled:cursor-not-allowed text-white font-bold text-lg shadow-[0_0_40px_-10px_rgba(249,115,22,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98]'>
						{isJoining ? (
							<>
								<Loader2 className='h-5 w-5 animate-spin' />
								Joining...
							</>
						) : (
							<>
								Join Interview Room
								<ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
							</>
						)}
					</button>

					<p className='text-center text-xs text-slate-500'>
						By joining, you agree to our Terms of Service and Privacy Policy.
					</p>
				</div>
			</main>
		</div>
	);
}
