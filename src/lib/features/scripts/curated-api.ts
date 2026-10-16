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
			? [{ section: raw.section, link: raw.link, json: raw.json }]
			: []
	);
}
