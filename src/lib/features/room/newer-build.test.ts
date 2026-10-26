import { beforeEach, describe, expect, it, vi } from 'vitest';

const check = vi.fn(() => Promise.resolve('current'));
vi.mock('#lib/features/about/update-check.svelte.ts', () => ({ updateCheck: { check } }));

describe('lookForNewerBuild', () => {
	beforeEach(() => {
		vi.resetModules();
		check.mockClear();
	});

	it('looks for a newer build once, then waits five minutes before looking again', async () => {
		const { lookForNewerBuild } = await import('./newer-build.ts');
		lookForNewerBuild(1_000);
		lookForNewerBuild(2_000);
		expect(check).toHaveBeenCalledTimes(1);
		lookForNewerBuild(1_000 + 5 * 60 * 1000);
		expect(check).toHaveBeenCalledTimes(2);
	});
});
