/**
 * Date/Time utility functions for consistent handling across the application
 * These functions ensure proper timezone handling and avoid hydration mismatches
 */

/**
 * Parse a date string/timestamp and return local date and time strings
 * suitable for HTML date/time inputs
 */
export function parseToLocalInputs(dateString: string): { date: string; time: string } {
	const d = new Date(dateString);

	if (isNaN(d.getTime())) {
		console.warn('Invalid date string:', dateString);
		return { date: '', time: '' };
	}

	// Get local date components
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	const hours = String(d.getHours()).padStart(2, '0');
	const minutes = String(d.getMinutes()).padStart(2, '0');

	return {
		date: `${year}-${month}-${day}`,
		time: `${hours}:${minutes}`,
	};
}

/**
 * Format a date for display (date only)
 * Uses a consistent format that works across SSR and client
 */
export function formatDate(dateString: string, options?: Intl.DateTimeFormatOptions): string {
	const d = new Date(dateString);

	if (isNaN(d.getTime())) {
		return 'Invalid Date';
	}

	// Use explicit options to ensure consistency
	const defaultOptions: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		...options,
	};

	try {
		return d.toLocaleDateString('en-US', defaultOptions);
	} catch {
		// Fallback for SSR
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
	}
}

/**
 * Format a date for display (time only)
 * Uses a consistent format that works across SSR and client
 */
export function formatTime(dateString: string, options?: Intl.DateTimeFormatOptions): string {
	const d = new Date(dateString);

	if (isNaN(d.getTime())) {
		return 'Invalid Time';
	}

	// Use explicit options to ensure consistency
	const defaultOptions: Intl.DateTimeFormatOptions = {
		hour: '2-digit',
		minute: '2-digit',
		hour12: true,
		...options,
	};

	try {
		return d.toLocaleTimeString('en-US', defaultOptions);
	} catch {
		// Fallback for SSR
		const hours = d.getHours();
		const minutes = String(d.getMinutes()).padStart(2, '0');
		const ampm = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours % 12 || 12;
		return `${String(displayHours).padStart(2, '0')}:${minutes} ${ampm}`;
	}
}

/**
 * Format a date for display (date and time)
 */
export function formatDateTime(dateString: string): string {
	return `${formatDate(dateString)} at ${formatTime(dateString)}`;
}

/**
 * Check if a date string is valid
 */
export function isValidDate(dateString: string): boolean {
	const d = new Date(dateString);
	return !isNaN(d.getTime());
}

/**
 * Get relative time description (e.g., "in 2 hours", "yesterday")
 */
export function getRelativeTime(dateString: string): string {
	const d = new Date(dateString);
	const now = new Date();
	const diffMs = d.getTime() - now.getTime();
	const diffMins = Math.round(diffMs / 60000);
	const diffHours = Math.round(diffMs / 3600000);
	const diffDays = Math.round(diffMs / 86400000);

	if (Math.abs(diffMins) < 1) return 'now';
	if (diffMins > 0 && diffMins < 60) return `in ${diffMins} minute${diffMins === 1 ? '' : 's'}`;
	if (diffMins < 0 && diffMins > -60) return `${Math.abs(diffMins)} minute${Math.abs(diffMins) === 1 ? '' : 's'} ago`;
	if (diffHours > 0 && diffHours < 24) return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
	if (diffHours < 0 && diffHours > -24) return `${Math.abs(diffHours)} hour${Math.abs(diffHours) === 1 ? '' : 's'} ago`;
	if (diffDays > 0 && diffDays < 7) return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
	if (diffDays < 0 && diffDays > -7) return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`;

	return formatDate(dateString);
}
