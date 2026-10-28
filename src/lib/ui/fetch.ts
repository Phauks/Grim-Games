/**
 * Every request the app makes goes through here (code cleanup, 2026-10-27: thirty hand-written
 * fetch calls, most with no timeout), so a server that never answers can't leave a screen
 * waiting forever. A request that runs out of time rejects with a `TimeoutError` DOMException,
 * as fetch does when it can't connect; one stopped by the caller's own signal still rejects
 * with an `AbortError`.
 */

/** A server that hasn't answered by then is treated as unreachable. */
export const FETCH_TIMEOUT_MS = 10_000;

/** For uploads and large downloads (pictures, recordings, reports): slow phones need longer. */
export const SLOW_FETCH_TIMEOUT_MS = 60_000;

export interface FetchOptions extends RequestInit {
	/** How long the whole request may take, body included. */
	timeoutMs?: number;
}

/** `signal`, and a timeout, whichever comes first. */
function withTimeout(signal?: AbortSignal | null, ms = FETCH_TIMEOUT_MS): AbortSignal {
	const timeout = AbortSignal.timeout(ms);
	return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/** `fetch`, given up after the timeout. */
export function fetchWithTimeout(
	input: RequestInfo | URL,
	{ timeoutMs = FETCH_TIMEOUT_MS, ...init }: FetchOptions = {}
): Promise<Response> {
	return fetch(input, { ...init, signal: withTimeout(init.signal, timeoutMs) });
}

/**
 * The response and its body read as JSON, `undefined` when the body isn't JSON. Rejects as
 * `fetchWithTimeout` does; an error status is the caller's to read from `response`.
 */
export async function fetchJson(
	input: RequestInfo | URL,
	options?: FetchOptions
): Promise<{ response: Response; body: unknown }> {
	const response = await fetchWithTimeout(input, options);
	const body: unknown = await response.json().catch(() => undefined);
	return { response, body };
}
