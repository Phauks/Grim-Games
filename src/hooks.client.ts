import type { HandleClientError } from '@sveltejs/kit/hooks';
import { installErrorReporting } from '#lib/features/errors/install.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { isMissingBuildFile, staleBuild } from '#lib/features/offline/stale-build.svelte.ts';

// Every error nothing else caught ends up in the one device-local error log
// (src/lib/features/errors), which shows the corner card and offers a GitHub report.
export const init = () => installErrorReporting();

export const handleError: HandleClientError = (caught) => {
	// The page that could not open, not the one the navigation started from.
	const page = caught.event.url?.pathname;
	// A newer build replaced this one's files: the next page loads afresh (stale-build.svelte.ts).
	// SvelteKit reports a link preloaded on touch this way without checking for a new build.
	// Still logged, without the corner card, so when the fresh load fails too the error page's
	// Details names the missing file (Trevor, 2026-10-26: "This page could not open" with
	// nothing in Details).
	if (isMissingBuildFile(caught.error)) {
		reportError(caught.error, { area: 'update', notify: false, page });
		return staleBuild.mark();
	}
	// Framework errors (an unknown address is a 404) and `error()` calls are expected;
	// +error.svelte explains them. Only bugs in our own code are reported.
	if (caught.kind === 'unknown') {
		reportError(caught.error, { area: 'navigation', handled: false, page });
	}
};
