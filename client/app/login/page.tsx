import AuthForm from './auth-form';

export default function LoginPage() {
	return (
		<div className='flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 sm:px-6 lg:px-8'>
			<div className='sm:mx-auto sm:w-full sm:max-w-md'>
				<h2 className='mt-6 text-center text-3xl font-extrabold text-gray-900'>Sign in/up to your account</h2>
			</div>

			<div className='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
				<div className='bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10'>
					<AuthForm />
				</div>
			</div>
		</div>
	);
}
