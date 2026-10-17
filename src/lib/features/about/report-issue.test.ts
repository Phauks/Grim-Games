import { describe, expect, it } from 'vitest';
import { describeBuild } from './report-issue.ts';

const info = {
	version: '0.0.1',
	commit: '0123456789abcdef',
	branch: 'main',
	builtAt: '2026-10-15T18:00:00.000Z',
	channel: 'production'
} as const;

describe('report issue link', () => {
	it('describes the build in one line', () => {
		expect(describeBuild(info)).toBe(
			'v0.0.1 · 0123456 · main · production · built 2026-10-15T18:00:00.000Z'
		);
	});
});
