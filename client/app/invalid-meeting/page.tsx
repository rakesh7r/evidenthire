import { AlertCircle } from 'lucide-react';

export default function InvalidMeetingPage() {
	return (
		<div className='min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4'>
			<div className='max-w-md w-full text-center space-y-6'>
				<div className='mx-auto h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20'>
					<AlertCircle className='h-10 w-10 text-red-500' />
				</div>
				<div className='space-y-2'>
					<h1 className='text-2xl font-bold text-white'>Invalid Meeting Link</h1>
					<p className='text-slate-400'>
						We couldn't verify your access to this interview. The link may have expired, or you might be using an
						incorrect access key.
					</p>
				</div>
				<div className='pt-6'>
					<a
						href='/'
						className='inline-flex items-center justify-center rounded-lg bg-slate-800 px-6 py-3 text-sm font-medium text-white hover:bg-slate-700 transition-colors'>
						Return Home
					</a>
				</div>
			</div>
		</div>
	);
}
