/**
 * The official site's curated scripts (Script of the Month, Recommended, Teensyville),
 * read by our Worker from TPI's Scripts page when the Storyteller asks for them, never
 * bundled. Each is a Script Tool link, so the Worker returns the scripts themselves.
 * Shared by the app and the Worker (`worker/curated.ts`). Design: 08 §5.6.
 */
import { BOTC_SCRIPTS_ORIGIN, readVersion, scriptPageUrl } from './botcscripts-api.ts';
import { officialName } from './script-names.ts';

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
	/** A past Script of the Month found through BotC Scripts' tag (`BOTC_MONTH_TAG`). */
	botc?: { scriptId: number; version: string };
}

/**
 * BotC Scripts' "Script of the Month" tag (botcscripts.com/?tags=27): earlier months than our
 * copy has seen, tagged by that site. It says which scripts, not which month.
 */
const BOTC_MONTH_TAG = 27;
/** The site's list of the tag's scripts, latest version of each. */
export const BOTC_MONTH_URL = `${BOTC_SCRIPTS_ORIGIN}/api/scripts/?tags=${BOTC_MONTH_TAG}&latest=true`;

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
						// Copies made before a name fix get it too.
						json: officialName(raw.json),
						...(typeof raw.seen === 'string' ? { seen: raw.seen } : {}),
						...(raw.past === true ? { past: true } : {}),
						...(isObject(raw.botc) &&
						typeof raw.botc.scriptId === 'number' &&
						typeof raw.botc.version === 'string'
							? { botc: { scriptId: raw.botc.scriptId, version: raw.botc.version } }
							: {})
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

/** The scripts on one page of `BOTC_MONTH_URL`, as past Scripts of the Month. */
export function readTaggedMonths(body: unknown): CuratedScript[] | undefined {
	if (!isObject(body) || !Array.isArray(body.results)) return undefined;
	return body.results.flatMap((row: unknown): CuratedScript[] => {
		const found = readVersion(row);
		if (!found || !Array.isArray(found.content)) return [];
		return [
			{
				section: 'month',
				link: scriptPageUrl(found.scriptId, found.version),
				json: officialName(found.content),
				past: true,
				botc: { scriptId: found.scriptId, version: found.version }
			}
		];
	});
}

function scriptName(json: readonly unknown[]): string {
	const meta = json.find((item) => isObject(item) && item.id === '_meta');
	return isObject(meta) && typeof meta.name === 'string' ? meta.name.trim().toLowerCase() : '';
}

/**
 * Our list with BotC Scripts' tagged months after the ones we saw ourselves, minus any already
 * there by name. Undefined `tagged` (the site didn't answer) keeps the tagged ones we had.
 */
export function addTaggedMonths(
	list: readonly CuratedScript[],
	tagged: readonly CuratedScript[] | undefined
): CuratedScript[] {
	const own = list.filter((s) => !s.botc);
	const kept = tagged ?? list.filter((s) => s.botc);
	const names = new Set(own.filter((s) => s.section === 'month').map((s) => scriptName(s.json)));
	return [...own, ...kept.filter((s) => !names.has(scriptName(s.json)))];
}
