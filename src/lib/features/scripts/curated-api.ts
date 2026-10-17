/**
 * The official site's curated scripts (Script of the Month, Recommended, Teensyville),
 * read by our Worker from TPI's Scripts page when the Storyteller asks for them, never
 * bundled. Each is a Script Tool link, so the Worker returns the scripts themselves.
 * Shared by the app and the Worker (`worker/curated.ts`). Design: 08 §5.6.
 */

export const CURATED_API = '/api/curated';
/** TPI's page listing the scripts it recommends. */
export const CURATED_PAGE = 'https://bloodontheclocktower.com/pages/custom-scripts';

export interface CuratedScript {
	/** The page section: a `CuratedSection` id ("recommended"), or the heading as written. */
	section: string;
	/** The Script Tool link it was listed with (also how it is loaded again later). */
	link: string;
	/** The script in TPI's format. */
	json: unknown[];
	/** A Script of the Month: the month our copy first saw it listed ("2026-10"). */
	seen?: string;
	/** A Script of the Month no longer on the page, kept from our copy. */
	past?: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The Worker's answer, checked; undefined when it isn't one. */
export function readCuratedList(body: unknown): CuratedScript[] | undefined {
	if (!isObject(body) || !Array.isArray(body.scripts)) return undefined;
	return body.scripts.flatMap((raw: unknown) =>
		isObject(raw) &&
		typeof raw.section === 'string' &&
		typeof raw.link === 'string' &&
		Array.isArray(raw.json)
			? [
					{
						section: raw.section,
						link: raw.link,
						json: raw.json,
						...(typeof raw.seen === 'string' ? { seen: raw.seen } : {}),
						...(raw.past === true ? { past: true } : {})
					}
				]
			: []
	);
}

/**
 * The page's scripts now, with every Script of the Month our copy has seen before kept as a
 * past one (Trevor, 2026-10-17: self-hosted, so earlier months aren't lost when the page
 * moves on). Each month keeps the month it was first seen; newest first.
 */
export function mergeCurated(
	previous: readonly CuratedScript[],
	current: readonly CuratedScript[],
	month: string
): CuratedScript[] {
	const before = new Map(previous.filter((s) => s.section === 'month').map((s) => [s.link, s]));
	const now = current.map((script): CuratedScript => {
		if (script.section !== 'month') return script;
		return { ...script, seen: before.get(script.link)?.seen ?? month };
	});
	const links = new Set(current.map((s) => s.link));
	const past = [...before.values()]
		.filter((s) => !links.has(s.link))
		.map((s): CuratedScript => ({ ...s, past: true }))
		.sort((a, b) => (b.seen ?? '').localeCompare(a.seen ?? ''));
	return [...now, ...past];
}
