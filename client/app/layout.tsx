import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

export const metadata: Metadata = {
	title: 'EvidentHire',
	description: 'Objective performance reports generated instantly from interview transcriptions',
};

import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang='en'
			suppressHydrationWarning>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				{process.env.NEXT_PUBLIC_GA_ID && (
					<>
						<Script
							src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
							strategy='afterInteractive'
						/>
						<Script
							id='google-analytics'
							strategy='afterInteractive'>
							{`
								window.dataLayer = window.dataLayer || [];
								function gtag(){dataLayer.push(arguments);}
								gtag('js', new Date());

								gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
							`}
						</Script>
					</>
				)}
				<ThemeProvider
					attribute='class'
					defaultTheme='dark'
					enableSystem
					disableTransitionOnChange>
					{children}
					<Toaster
						position='top-right'
						richColors
						closeButton
					/>
				</ThemeProvider>
			</body>
		</html>
	);
}
