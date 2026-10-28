import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, fetchWithTimeout, FETCH_TIMEOUT_MS } from './fetch.ts';

/** A fetch that answers `body`, or never answers until its signal aborts. */
function stubFetch(body?: string) {
	const calls: RequestInit[] = [];
	vi.stubGlobal('fetch', (_input: RequestInfo | URL, init: RequestInit = {}) => {
		calls.push(init);
		if (body !== undefined) return Promise.resolve(new Response(body, { status: 200 }));
		return new Promise<Response>((_, reject) => {
			init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
		});
	});
	return calls;
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('fetchWithTimeout', () => {
	it('passes the request on, with a signal', async () => {
		const calls = stubFetch('ok');
		const response = await fetchWithTimeout('/x', { method: 'POST', credentials: 'omit' });
		expect(await response.text()).toBe('ok');
		expect(calls[0]).toMatchObject({ method: 'POST', credentials: 'omit' });
		expect(calls[0].signal).toBeInstanceOf(AbortSignal);
		expect(calls[0]).not.toHaveProperty('timeoutMs');
	});

	it('gives up after the timeout, 10 s unless the caller asks for longer', () => {
		stubFetch();
		const timeout = vi.spyOn(AbortSignal, 'timeout');
		void fetchWithTimeout('/x').catch(() => {});
		void fetchWithTimeout('/x', { timeoutMs: 60_000 }).catch(() => {});
		expect(timeout.mock.calls).toEqual([[FETCH_TIMEOUT_MS], [60_000]]);
	});

	it('rejects with a TimeoutError when the server never answers', async () => {
		stubFetch();
		await expect(fetchWithTimeout('/x', { timeoutMs: 10 })).rejects.toMatchObject({
			name: 'TimeoutError'
		});
	});

	it("still stops with an AbortError on the caller's own signal", async () => {
		stubFetch();
		const controller = new AbortController();
		const request = fetchWithTimeout('/x', { signal: controller.signal });
		controller.abort();
		await expect(request).rejects.toMatchObject({ name: 'AbortError' });
	});
});

describe('fetchJson', () => {
	it('reads the body as JSON', async () => {
		stubFetch('{"a":1}');
		const { response, body } = await fetchJson('/x');
		expect(response.ok).toBe(true);
		expect(body).toEqual({ a: 1 });
	});

	it('gives undefined for a body that is not JSON', async () => {
		stubFetch('<html>');
		expect((await fetchJson('/x')).body).toBeUndefined();
	});
});
