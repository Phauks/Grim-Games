/**
 * Script names as the lists we mirror show them, where a script's own JSON gets it wrong or
 * leaves it out (Trevor, 2026-10-18). Applied when our copy is made (`worker/`), so a script
 * saved from Search keeps the name too.
 */

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The name in a script's `_meta`, trimmed; '' when it has none. */
export function scriptJsonName(json: readonly unknown[]): string {
	const meta = json.find((entry) => isObject(entry) && entry.id === '_meta');
	return isObject(meta) && typeof meta.name === 'string' ? meta.name.trim() : '';
}

/** The script with `name` in its `_meta` (a `_meta` is added first when it has none). */
export function withScriptName(json: readonly unknown[], name: string): unknown[] {
	const at = json.findIndex((entry) => isObject(entry) && entry.id === '_meta');
	if (at < 0) return [{ id: '_meta', name }, ...json];
	return json.map((entry, i) => (i === at ? { ...(entry as object), name } : entry));
}

/**
 * The name a listing gives a script (a collection doc's heading), used when the script names
 * itself nothing, or the same words in other capitals. A listing name that differs in words
 * (a version, a subtitle) never replaces the script's own.
 */
export function nameFromListing(json: readonly unknown[], listed: string | undefined): unknown[] {
	const title = listed?.replace(/\s+/g, ' ').trim();
	if (!title) return [...json];
	const own = scriptJsonName(json);
	if (own === title) return [...json];
	return !own || own.toLowerCase() === title.toLowerCase()
		? withScriptName(json, title)
		: [...json];
}

/**
 * Official scripts whose JSON writes their name differently from how TPI lists it
 * (bloodontheclocktower.com/pages/custom-scripts, checked 2026-10-18).
 */
const OFFICIAL_NAMES: Readonly<Record<string, string>> = {
	'One in one out': 'One In One Out'
};

export function officialName(json: readonly unknown[]): unknown[] {
	const fixed = OFFICIAL_NAMES[scriptJsonName(json)];
	return fixed ? withScriptName(json, fixed) : [...json];
}
