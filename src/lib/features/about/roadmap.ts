/**
 * The roadmap, kept in the repository so it ticks itself off. Each item is a feature, made of
 * the backlog plan's IDs (such as D1, L2 or W10; the plan lists them all):
 * a part is finished once a merged change names its ID in brackets in its title, such as
 * "Savant info generator (L2)", and an item is done once all its parts and listed PRs are.
 * Only the features are shown, grouped by the area of the app they belong to (Trevor,
 * 2026-10-30). Add a new plan ID to the feature it belongs to, or a new feature for it in its
 * area; bug fixes and polish need no item. Never tick anything by hand. The features live in
 * roadmap-storyteller.ts, roadmap-engine.ts and roadmap-app.ts, by area, and roadmap-parts.ts
 * holds the PRs that finished parts whose titles named no ID.
 */
import type { BuildCommit } from './update-notes.ts';
import type { Change } from './changelog.ts';
import { PART_PRS } from './roadmap-parts.ts';
import { STORYTELLER_AND_PLAYER } from './roadmap-storyteller.ts';
import { ENGINE } from './roadmap-engine.ts';
import { PAGES_AND_APP } from './roadmap-app.ts';

/**
 * The page's sections, in its order (Trevor, 2026-10-30: "delineate between storyteller,
 * player, search, saved, friends, user profile, etc."; Storyteller and Player come first).
 * Search, Library, Friends and History are the menu's own pages; Prepare is the menu's group
 * for what is made before a game (the builders, Info tokens, the Character reference, the
 * printed sheet); App is everything the whole app shares. Engine (Trevor, 2026-10-31) is the
 * rules the app plays by: every official character's behaviour as data, on the way to full
 * parity with no character written into code.
 */
export const ROADMAP_AREAS = [
	'storyteller',
	'player',
	'engine',
	'search',
	'library',
	'prepare',
	'friends',
	'profile',
	'history',
	'app'
] as const;
export type RoadmapArea = (typeof ROADMAP_AREAS)[number];

export interface RoadmapItem {
	title: string;
	area: RoadmapArea;
	/** The plan IDs it is made of. */
	parts?: string[];
	/** PRs that are part of it, for work whose titles name no ID. */
	prs?: number[];
	/** Not planned for now. */
	later?: true;
}

export const ROADMAP: readonly RoadmapItem[] = [
	...STORYTELLER_AND_PLAYER,
	...ENGINE,
	...PAGES_AND_APP
];

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
