import { describe, expect, it } from 'vitest';
import { serverLogFilter } from './quiet-server-log.ts';

const stack =
	'  stack: /w/node_modules/@cloudflare/workerd-linux-64/bin/workerd@58261f3 /w/node_modules/@cloudflare/workerd-linux-64/bin/workerd@5829de7';

describe('quiet server log', () => {
	it('drops a browser hanging up, with its native stack, and keeps every other line', () => {
		const keep = serverLogFilter();
		const lines = [
			'✘ [ERROR] kj::getCaughtExceptionAsKj() = rust/cxx/kj-rs-io/ffi.rs:176: disconnected: write(): Broken pipe (os error 32)',
			'',
			stack,
			'',
			'✘ [ERROR] kj::getCaughtExceptionAsKj() = rust/cxx/kj-rs-io/ffi.rs:176: disconnected: write(): Connection reset by peer (os error 104)',
			stack,
			'✘ [ERROR] Uncaught TypeError: Something real.',
			'',
			'      at send (file:///w/worker/room.ts:649:5)'
		];
		expect(lines.filter(keep)).toEqual([
			'✘ [ERROR] Uncaught TypeError: Something real.',
			'',
			'      at send (file:///w/worker/room.ts:649:5)'
		]);
	});
});
