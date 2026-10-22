import { describe, expect, it } from 'vitest';
import { groupDirectCommits } from './direct-commits.ts';
import type { Change } from './changelog.ts';

const c = (sha: string, date: string, pr?: number): Change => ({
	sha,
	subject: `Change ${sha}`,
	date,
	...(pr ? { pr } : {})
});

describe('groupDirectCommits', () => {
	it('turns a day of direct commits into one line, keeping PRs and lone commits', () => {
		const grouped = groupDirectCommits([
			c('f', '2026-10-19', 20),
			c('e', '2026-10-18'),
			c('d', '2026-10-18'),
			c('c', '2026-10-18'),
			c('b', '2026-10-17'),
			c('a', '2026-10-17', 1)
		]);
		expect(grouped).toEqual([
			c('f', '2026-10-19', 20),
			{
				sha: 'e',
				subject: '3 commits made straight on the branch',
				commits: 3,
				date: '2026-10-18'
			},
			c('b', '2026-10-17'),
			c('a', '2026-10-17', 1)
		]);
	});

	it("joins a day's direct commits around its PRs, where the newest was", () => {
		const grouped = groupDirectCommits([
			c('c', '2026-10-18'),
			c('b', '2026-10-18', 5),
			c('a', '2026-10-18')
		]);
		expect(grouped.map((g) => [g.sha, g.commits])).toEqual([
			['c', 2],
			['b', undefined]
		]);
	});
});
