// Kept apart from changelog.ts, which reads the build's injected history when loaded, so the
// build (build-info.ts) can use it before that history exists.
import type { Change } from './changelog.ts';

/**
 * Turns a day's two or more commits made straight on the branch into one line, where the
 * newest of them was, so the list counts changes the way pull requests do. Before branch
 * protection (2026-10-18) work was committed directly to beta, hundreds of commits a day.
 */
export function groupDirectCommits(changes: readonly Change[]): Change[] {
	const days = new Map<string, Change[]>();
	for (const change of changes)
		if (change.pr === undefined) {
			const key = `${change.release ?? ''} ${change.date}`;
			days.set(key, [...(days.get(key) ?? []), change]);
		}
	return changes.flatMap((change): Change[] => {
		if (change.pr !== undefined) return [change];
		const day = days.get(`${change.release ?? ''} ${change.date}`) ?? [change];
		if (day.length === 1) return [change];
		if (day[0] !== change) return [];
		return [
			{
				sha: change.sha,
				subject: `${day.length} commits made straight on the branch`,
				commits: day.length,
				date: change.date,
				...(change.release ? { release: change.release } : {})
			}
		];
	});
}
