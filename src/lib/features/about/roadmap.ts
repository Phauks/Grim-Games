/**
 * The roadmap, kept in the repository so it ticks itself off. Each item is a feature, made of
 * the backlog plan's IDs (such as D1, L2 or W10; the plan lists them all):
 * a part is finished once a merged change names its ID in brackets in its title, such as
 * "Savant info generator (L2)", and an item is done once all its parts and listed PRs are.
 * Only the features are shown, grouped by the area of the app they belong to (Trevor,
 * 2026-10-30). Add a new plan ID to the feature it belongs to, or a new feature for it in its
 * area; bug fixes and polish need no item. Never tick anything by hand.
 */

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

/**
 * Parts whose PR titles didn't name them: the PR that finished each. Empty while the roadmap
 * is (Trevor, 2026-11-06: "empty roadmap page. you can keep the functionality, but remove
 * entries").
 */
export const PART_PRS: Readonly<Record<string, number>> = {};

/** The features, each in its area. Empty for now; the page then shows None. */
export const ROADMAP: readonly RoadmapItem[] = [];
