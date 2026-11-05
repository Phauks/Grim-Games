/**
 * How far along each roadmap feature is, worked out from the merged changes' titles
 * (the items themselves are in roadmap.ts).
 */
import type { BuildCommit } from './update-notes.ts';
import type { Change } from './changelog.ts';
import { PART_PRS, ROADMAP_AREAS, type RoadmapArea, type RoadmapItem } from './roadmap.ts';

export interface RoadmapEntry extends RoadmapItem {
	/** How many of its parts and PRs have merged. */
	finished: number;
	total: number;
	/** The change that finished it, once every part has merged. */
	doneBy?: BuildCommit;
}

export interface RoadmapAreaEntries {
	area: RoadmapArea;
	/** Unfinished first, then later, then done. */
	items: RoadmapEntry[];
	done: number;
}

export interface RoadmapStatus {
	done: RoadmapEntry[];
	next: RoadmapEntry[];
	later: RoadmapEntry[];
}

/** The IDs a change's title names in brackets: "(L8, L18a)", "(L20 + L7)". */
export function idsIn(subject: string): string[] {
	return [...subject.matchAll(/\(([^)]*)\)/g)].flatMap(([, inside]) =>
		inside.split(/[\s,+/&]+/).filter((word) => /^[A-Z]\d+[a-z]?$/.test(word))
	);
}

/** Each item with how far along it is, split into done, next and later. */
export function roadmapStatus(
	items: readonly RoadmapItem[],
	changes: readonly Change[],
	partPrs: Readonly<Record<string, number>> = PART_PRS
): RoadmapStatus {
	// Each change's position, oldest first, so a finished item names its last piece.
	const byId = new Map<string, number>();
	const byPr = new Map<number, number>();
	const commits = [...changes].reverse().map(({ sha, subject, pr }, at): BuildCommit => {
		for (const id of idsIn(subject)) if (!byId.has(id)) byId.set(id, at);
		if (pr !== undefined) byPr.set(pr, at);
		return pr === undefined ? { sha, subject } : { sha, subject, pr };
	});
	const status: RoadmapStatus = { done: [], next: [], later: [] };
	for (const item of items) {
		const pieces = [
			...(item.parts ?? []).map((id) => {
				const pr = partPrs[id];
				return byId.get(id) ?? (pr === undefined ? undefined : byPr.get(pr));
			}),
			...(item.prs ?? []).map((pr) => byPr.get(pr))
		];
		const merged = pieces.filter((at) => at !== undefined);
		const entry: RoadmapEntry = { ...item, finished: merged.length, total: pieces.length };
		if (pieces.length > 0 && merged.length === pieces.length) {
			status.done.push({ ...entry, doneBy: commits[Math.max(...merged)] });
		} else (item.later ? status.later : status.next).push(entry);
	}
	return status;
}

/** Each area that has features, in the page's order, with its unfinished features first. */
export function roadmapByArea(status: RoadmapStatus): RoadmapAreaEntries[] {
	return ROADMAP_AREAS.map((area) => {
		const inArea = (entries: RoadmapEntry[]) => entries.filter((entry) => entry.area === area);
		const done = inArea(status.done);
		return {
			area,
			items: [...inArea(status.next), ...inArea(status.later), ...done],
			done: done.length
		};
	}).filter(({ items }) => items.length > 0);
}
