import { QueryClient } from '@tanstack/react-query';

const defaultOpts = {
	queries: {
		refetchOnWindowFocus: false,
		retry: 1,
		// Cache is considered fresh for 30 s → navigating back to a page shows
		// cached data instantly instead of always waiting for a network round-trip.
		staleTime: 30_000,
	},
};

/** App-wide cache (e.g. /AdminCourses, Layout, dashboards). */
export const queryClientInstance = new QueryClient({
	defaultOptions: defaultOpts,
});

/**
 * Isolated cache only for `/admincourses` (AdminCoursesAdminRoute) so template/course
 * queries and invalidations never overlap `/AdminCourses` or other pages.
 */
export const queryClientAdmincourses = new QueryClient({
	defaultOptions: defaultOpts,
});