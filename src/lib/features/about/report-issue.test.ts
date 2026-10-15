import { describe, expect, it } from 'vitest';
import { bugReportUrl, describeBuild } from './report-issue.ts';

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

	it('prefills the bug report form with build, page and device', () => {
		const url = new URL(bugReportUrl(info, '/settings', 'Phone UA'));
		expect(url.origin + url.pathname).toBe('https://github.com/Phauks/Grim-Games/issues/new');
		expect(url.searchParams.get('template')).toBe('bug_report.yml');
		expect(url.searchParams.get('build')).toBe(describeBuild(info));
		expect(url.searchParams.get('page')).toBe('/settings');
		expect(url.searchParams.get('device')).toBe('Phone UA');
	});
});
