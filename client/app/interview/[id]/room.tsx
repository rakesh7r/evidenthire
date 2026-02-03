'use client';

import {
	ControlBar,
	GridLayout,
	LiveKitRoom,
	ParticipantTile,
	RoomAudioRenderer,
	useTracks,
	useParticipants,
	useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { useState, useEffect, useCallback } from 'react';
import { PhoneOff, UserPlus, AlertCircle, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface InterviewRoomProps {
	token: string;
	serverUrl: string;
	onLeave: () => void;
	micEnabled: boolean;
	camEnabled: boolean;
	interviewId?: string;
	isInterviewer?: boolean;
	roundTitle?: string;
}

export default function InterviewRoom({
	token,
	serverUrl,
	onLeave,
	micEnabled,
	camEnabled,
	interviewId,
	isInterviewer = false,
	roundTitle,
}: InterviewRoomProps) {
	return (
		<LiveKitRoom
			video={camEnabled}
			audio={micEnabled}
			token={token}
			serverUrl={serverUrl}
			data-lk-theme='default'
			style={{ height: '100vh' }}
			onDisconnected={onLeave}>
			<MyVideoConference
				onLeave={onLeave}
				interviewId={interviewId}
				isInterviewer={isInterviewer}
				roundTitle={roundTitle}
			/>
			<RoomAudioRenderer />
		</LiveKitRoom>
	);
}

interface WaitingRoomStatus {
	isWaiting: boolean;
	waitingSince: string | null;
	isAdmitted: boolean;
}

function MyVideoConference({
	onLeave,
	interviewId,
	isInterviewer,
	roundTitle,
}: {
	onLeave: () => void;
	interviewId?: string;
	isInterviewer?: boolean;
	roundTitle?: string;
}) {
	const tracks = useTracks(
		[
			{ source: Track.Source.Camera, withPlaceholder: true },
			{ source: Track.Source.ScreenShare, withPlaceholder: false },
		],
		{ onlySubscribed: false }
	);

	const participants = useParticipants();
	const [candidateWaiting, setCandidateWaiting] = useState<WaitingRoomStatus | null>(null);
	const [isEnding, setIsEnding] = useState(false);
	const [isAdmitting, setIsAdmitting] = useState(false);

	// Poll for waiting room status (interviewer only)
	const checkWaitingRoom = useCallback(async () => {
		if (!interviewId || !isInterviewer) return;

		try {
			const res = await api.get(`/interviews/public/${interviewId}/waiting-status`);
			setCandidateWaiting(res.data);
		} catch (err) {
			console.error('Error checking waiting room:', err);
		}
	}, [interviewId, isInterviewer]);

	useEffect(() => {
		if (!isInterviewer || !interviewId) return;

		// Check immediately
		checkWaitingRoom();

		// Poll every 5 seconds
		const interval = setInterval(checkWaitingRoom, 5000);
		return () => clearInterval(interval);
	}, [isInterviewer, interviewId, checkWaitingRoom]);

	// Admit candidate from waiting room
	const handleAdmitCandidate = async () => {
		if (!interviewId) return;
		setIsAdmitting(true);

		try {
			await api.post(`/interviews/${interviewId}/admit`);
			toast.success('Candidate has been admitted to the interview.');
			setCandidateWaiting((prev) => (prev ? { ...prev, isWaiting: false, isAdmitted: true } : null));
		} catch (err: any) {
			console.error('Error admitting candidate:', err);
			toast.error(err.response?.data?.error || 'Failed to admit candidate.');
		} finally {
			setIsAdmitting(false);
		}
	};

	// End interview (interviewer only)
	const handleEndInterview = async () => {
		if (!interviewId) {
			onLeave();
			return;
		}

		setIsEnding(true);
		try {
			const res = await api.post(`/interviews/${interviewId}/end`);
			toast.success(res.data.message || 'Interview ended successfully.');
			onLeave();
		} catch (err: any) {
			console.error('Error ending interview:', err);
			// Still leave even if end API fails
			toast.error(err.response?.data?.error || 'Failed to end interview, but leaving room.');
			onLeave();
		} finally {
			setIsEnding(false);
		}
	};

	return (
		<div className='flex flex-col h-full bg-slate-950'>
			{/* Waiting Room Notification for Interviewer */}
			{isInterviewer && candidateWaiting?.isWaiting && (
				<div className='bg-blue-500/10 border-b border-blue-500/20 px-6 py-3 flex items-center justify-between'>
					<div className='flex items-center gap-3'>
						<div className='h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center'>
							<UserPlus className='h-5 w-5 text-blue-400' />
						</div>
						<div>
							<p className='font-medium text-white'>Candidate is waiting</p>
							<p className='text-sm text-blue-300'>Admit them to start the interview</p>
						</div>
					</div>
					<button
						onClick={handleAdmitCandidate}
						disabled={isAdmitting}
						className='px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium flex items-center gap-2 transition-colors'>
						{isAdmitting ? (
							<>
								<span className='h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
								Admitting...
							</>
						) : (
							<>
								<CheckCircle className='h-4 w-4' />
								Admit Candidate
							</>
						)}
					</button>
				</div>
			)}

			{/* Participant count indicator */}
			<div className='absolute top-4 left-4 z-10 flex flex-col gap-2'>
				<div className='px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 text-sm text-slate-300 flex items-center gap-2 w-fit'>
					<span className='h-2 w-2 rounded-full bg-green-500 animate-pulse' />
					{participants.length} participant{participants.length !== 1 ? 's' : ''}
				</div>
				{roundTitle && (
					<div className='px-3 py-1.5 rounded-full bg-orange-900/80 border border-orange-700 text-sm text-orange-200 flex items-center gap-2 w-fit'>
						<span className='font-medium'>{roundTitle}</span>
					</div>
				)}
			</div>

			<div className='flex-1 p-4'>
				<GridLayout
					tracks={tracks}
					style={{ height: '100%' }}>
					<ParticipantTile />
				</GridLayout>
			</div>

			{/* Custom Control Bar */}
			<div className='h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-4 px-6'>
				<ControlBar
					variation='minimal'
					controls={{ chat: false, screenShare: true, leave: false }}
				/>

				{/* End/Leave button - different behavior for interviewer vs candidate */}
				{isInterviewer ? (
					<button
						onClick={handleEndInterview}
						disabled={isEnding}
						className='h-10 px-4 rounded-full bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 flex items-center justify-center gap-2 text-white font-medium transition-colors'
						title='End Interview'>
						{isEnding ? (
							<>
								<span className='h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
								Ending...
							</>
						) : (
							<>
								<PhoneOff className='h-5 w-5' />
								End Interview
							</>
						)}
					</button>
				) : (
					<button
						onClick={onLeave}
						className='h-10 w-10 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors'
						title='Leave Meeting'>
						<PhoneOff className='h-5 w-5' />
					</button>
				)}
			</div>
		</div>
	);
}
