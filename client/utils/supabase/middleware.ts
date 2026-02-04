import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
					supabaseResponse = NextResponse.next({
						request,
					});
					cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
				},
			},
		}
	);

	// IMPORTANT: Avoid writing any logic between createServerClient and
	// supabase.auth.getUser(). A simple mistake could make it very hard to debug
	// issues with users being randomly logged out.

	const {
		data: { user },
	} = await supabase.auth.getUser();

	// Check for candidate access via URL params
	const isInterviewPath = request.nextUrl.pathname.startsWith('/interview/');
	const email = request.nextUrl.searchParams.get('email');
	const candidateKey = request.nextUrl.searchParams.get('candidate_access_key');

	let isValidCandidate = false;

	if (isInterviewPath && email && candidateKey) {
		const pathParts = request.nextUrl.pathname.split('/');
		// /interview/[id] -> ['', 'interview', 'id']
		const interviewId = pathParts[2];
		if (interviewId) {
			try {
				const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000/api/v1';
				const validateRes = await fetch(
					`${apiUrl}/interviews/public/${interviewId}/validate?email=${encodeURIComponent(
						email
					)}&candidate_access_key=${candidateKey}`
				);
				if (validateRes.ok) {
					isValidCandidate = true;
				}
			} catch (err) {
				console.error('Middleware validation error:', err);
			}
		}
	}

	if (
		!user &&
		!request.nextUrl.pathname.startsWith('/login') &&
		!request.nextUrl.pathname.startsWith('/auth') &&
		!request.nextUrl.pathname.startsWith('/invalid-meeting') &&
		!request.nextUrl.pathname.startsWith('/careers') &&
		request.nextUrl.pathname !== '/' &&
		!isValidCandidate
	) {
		const isInterviewer = request.nextUrl.searchParams.get('isInterviewer') === 'true';

		// If trying to access interview without valid candidate credentials
		if (isInterviewPath && !isInterviewer) {
			// If they provided credentials but failed validation, OR just tried to visit the link directly
			// Redirect to invalid meeting page
			const url = request.nextUrl.clone();
			url.pathname = '/invalid-meeting';
			return NextResponse.redirect(url);
		}

		// no user, potentially redirect them to the login page
		const url = request.nextUrl.clone();
		url.pathname = '/login';
		return NextResponse.redirect(url);
	}

	if (user && request.nextUrl.pathname.startsWith('/login')) {
		const url = request.nextUrl.clone();
		url.pathname = '/';
		return NextResponse.redirect(url);
	}

	return supabaseResponse;
}
