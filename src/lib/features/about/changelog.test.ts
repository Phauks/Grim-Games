import { describe, expect, it } from 'vitest';
import { changeHistory, changelogReleases, type Change } from './changelog.ts';

const change = (sha: string, date: string, release?: string, pr?: number): Change => ({
	sha,
	subject: `Change ${sha}`,
	date,
	...(pr ? { pr } : {}),
	...(release ? { release } : {})
});

describe('changelog', () => {
	it('groups changes by release, Unreleased first, then by day', () => {
		const releases = changelogReleases({
			complete: true,
			changes: [
				change('d', '2026-11-02', undefined, 12),
				change('c', '2026-11-01'),
				change('b', '2026-10-30', '0.5.0', 11),
				change('a', '2026-10-30', '0.5.0')
			]
		});
		expect(releases.map((r) => [r.version, r.date, r.count])).toEqual([
			[null, '2026-11-02', 2],
			['0.5.0', '2026-10-30', 2]
		]);
		expect(releases[0].days.map((d) => d.date)).toEqual(['2026-11-02', '2026-11-01']);
		expect(releases[0].days[0].changes).toEqual({
			commits: [{ sha: 'd', subject: 'Change d', pr: 12 }],
			complete: true
		});
		expect(releases[1].days[0].changes.commits.map((c) => c.sha)).toEqual(['b', 'a']);
	});

	it('marks only the oldest day incomplete when the history stops short', () => {
		const releases = changelogReleases({
			complete: false,
			changes: [change('b', '2026-10-31'), change('a', '2026-10-30')]
		});
		expect(releases[0].days.map((d) => d.changes.complete)).toEqual([true, false]);
	});

	it('has no releases for an empty history', () => {
		expect(changelogReleases({ complete: true, changes: [] })).toEqual([]);
	});

	it('is filled from the repository at build time', () => {
		expect(changeHistory.changes.length).toBeGreaterThan(0);
		for (const c of changeHistory.changes) expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
