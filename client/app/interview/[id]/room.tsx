'use client';

import {
	ControlBar,
	GridLayout,
	LiveKitRoom,
	ParticipantTile,
	RoomAudioRenderer,
	useTracks,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { useState } from 'react';
import { Loader2, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface InterviewRoomProps {
	token: string;
	serverUrl: string;
	onLeave: () => void;
	micEnabled: boolean;
	camEnabled: boolean;
}

export default function InterviewRoom({ token, serverUrl, onLeave, micEnabled, camEnabled }: InterviewRoomProps) {
	return (
		<LiveKitRoom
			video={camEnabled}
			audio={micEnabled}
			token={token}
			serverUrl={serverUrl}
			data-lk-theme='default'
			style={{ height: '100vh' }}
			onDisconnected={onLeave}>
			<MyVideoConference onLeave={onLeave} />
			<RoomAudioRenderer />
		</LiveKitRoom>
	);
}

function MyVideoConference({ onLeave }: { onLeave: () => void }) {
	const tracks = useTracks(
		[
			{ source: Track.Source.Camera, withPlaceholder: true },
			{ source: Track.Source.ScreenShare, withPlaceholder: false },
		],
		{ onlySubscribed: false }
	);

	return (
		<div className='flex flex-col h-full bg-slate-950'>
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
				<button
					onClick={onLeave}
					className='h-10 w-10 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-colors'
					title='Leave Meeting'>
					<PhoneOff className='h-5 w-5' />
				</button>
			</div>
		</div>
	);
}
