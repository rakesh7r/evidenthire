'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
	Video,
	Mic,
	MicOff,
	VideoOff,
	Settings,
	User,
	Briefcase,
	Building2,
	Clock,
	Calendar,
	Loader2,
	AlertCircle,
	ArrowRight,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import InterviewRoom from './room';
import { createLocalAudioTrack, createLocalVideoTrack, LocalAudioTrack, LocalVideoTrack } from 'livekit-client';
import { useRef } from 'react';

interface PublicInterview {
	id: string;
	candidate_name: string;
	position_title: string;
	organization_name: string;
	scheduled_start: string;
	status: string;
}

export default function JoinInterviewPage() {
	const { id } = useParams();
	const router = useRouter();
	const searchParams = useSearchParams();
	const [interview, setInterview] = useState<PublicInterview | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Media states
	const [isMicOn, setIsMicOn] = useState(true);
	const [isVideoOn, setIsVideoOn] = useState(true);
	const [token, setToken] = useState<string | null>(null);
	const [isJoined, setIsJoined] = useState(false);

	// Local tracks for preview
	const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
	const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);

	const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL;

	useEffect(() => {
		if (!id) return;

		async function fetchInterview() {
			try {
				const res = await api.get(`/interviews/public/${id}`);
				setInterview(res.data);
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

		if (!isJoined && !isLoading && interview) {
			initTracks();
		}

		return () => {
			// Cleanup tracks on unmount or join
			if (!isJoined) {
				localVideoTrack?.stop();
				localAudioTrack?.stop();
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLoading, isJoined]);

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
				await localVideoTrack.unmute(); // or restart
			} else {
				await localVideoTrack.mute(); // or stop, but mute keeps the track object
			}
			setIsVideoOn(newState);
		}
	};

	const handleJoin = async () => {
		if (!interview || !id) return;
		setIsLoading(true);

		try {
			// For simplicity, we'll use a random name for now or the candidate name if we can infer it logic-wise.
			// Ideally, we'd prompt for a name if it's a guest, or use user details if logged in.
			// Here we simply use "Participant" + suffix if not logged in, but for actual demo we use candidate name
			const participantName = interview.candidate_name || 'Guest User';
			const identity = `user-${Math.random().toString(36).substr(2, 9)}`;

			// Get auth params from URL if present
			const email = searchParams.get('email');
			const userKey = searchParams.get('userKey');

			const res = await api.get(`/interviews/public/${id}/token`, {
				params: {
					name: participantName,
					identity: identity,
					email: email,
					userKey: userKey,
				},
			});

			setToken(res.data.token);
			setIsJoined(true);
		} catch (err: any) {
			console.error('Failed to get token:', err);
			toast.error('Failed to join the room. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleLeave = () => {
		setIsJoined(false);
		setToken(null);
		toast.info('You have left the interview.');
	};

	if (isJoined && token && LIVEKIT_URL) {
		return (
			<InterviewRoom
				token={token}
				serverUrl={LIVEKIT_URL}
				onLeave={handleLeave}
				micEnabled={isMicOn}
				camEnabled={isVideoOn}
			/>
		);
	}

	if (isLoading) {
		return (
			<div className='min-h-screen bg-slate-950 flex flex-col items-center justify-center'>
				<Loader2 className='h-12 w-12 text-orange-500 animate-spin mb-4' />
				<p className='text-slate-400 font-medium'>Preparing your lobby...</p>
			</div>
		);
	}

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

	const scheduledDate = new Date(interview.scheduled_start);

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
								<span className='text-sm text-slate-300'>{scheduledDate.toLocaleDateString()}</span>
							</div>
							<div className='flex items-center gap-3'>
								<Clock className='h-4 w-4 text-slate-500' />
								<span className='text-sm text-slate-300'>
									{scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
								</span>
							</div>
						</div>
					</div>

					<button
						onClick={handleJoin}
						className='w-full h-16 group relative flex items-center justify-center gap-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-lg shadow-[0_0_40px_-10px_rgba(249,115,22,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98]'>
						Join Interview Room
						<ArrowRight className='h-5 w-5 transition-transform group-hover:translate-x-1' />
					</button>

					<p className='text-center text-xs text-slate-500'>
						By joining, you agree to our Terms of Service and Privacy Policy.
					</p>
				</div>
			</main>
		</div>
	);
}
