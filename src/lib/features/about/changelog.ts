/**
 * The changelog, grouped the way Keep a Changelog 1.1.0 does (keepachangelog.com): one block
 * per release, each with the same fixed categories. Left empty until 1.0 (Trevor,
 * 2026-10-15); add a release here, newest first, and the page lays it out.
 */
export const CHANGE_CATEGORIES = [
	'Added',
	'Changed',
	'Deprecated',
	'Removed',
	'Fixed',
	'Security'
] as const;
export type ChangeCategory = (typeof CHANGE_CATEGORIES)[number];

export interface Release {
	/** e.g. '1.0.0'; `null` for changes not yet released. */
	version: string | null;
	/** ISO date (YYYY-MM-DD) of the release; `null` while unreleased. */
	date: string | null;
	changes: Partial<Record<ChangeCategory, string[]>>;
}

export const RELEASES: readonly Release[] = [{ version: null, date: null, changes: {} }];

/** Every category in the fixed order, with an empty list where nothing changed. */
export function releaseSections(release: Release): { category: ChangeCategory; items: string[] }[] {
	return CHANGE_CATEGORIES.map((category) => ({
		category,
		items: release.changes[category] ?? []
	}));
}
