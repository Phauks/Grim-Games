/**
 * Bloodstar Clocktica's published scripts (https://bloodstar.clocktica.com) as a Search
 * source (Trevor, 2026-10-18: spike). Shared by the Worker, which fetches the site (its code
 * sends no CORS headers), and the page, which reads our answer.
 *
 * Two of the site's public read endpoints are used (research:
 * /mnt/project-files/scripts/bloodstar-source.md):
 * - `/api/allpublished.php`: every published script as `[scriptPath, almanacPath]`, paths
 *   only (no names, authors or characters). Our Worker keeps one copy (`worker/mirror.ts`);
 * - `/p/<user>/<edition>/script.json`: one script in TPI's format, fetched when opened.
 * The site moved from www.bloodstar.xyz, whose old `/p/` links still answer; both hosts'
 * links are read. The site has no licence: every script credits its folder's user and links
 * to its own almanac page.
 */

export const BLOODSTAR_ORIGIN = 'https://bloodstar.clocktica.com';
/** Our Worker's routes for the list and for one script (`worker/bloodstar.ts`). */
export const BLOODSTAR_API = '/api/bloodstar';

const HOSTS = new Set(['bloodstar.clocktica.com', 'bloodstar.xyz', 'www.bloodstar.xyz']);

/** One published script: the user's folder and the script's folder on the site. */
export interface BloodstarScript {
	user: string;
	edition: string;
}

/**
 * A folder name as the site allows it (no slashes, quotes, colons or `<>|?`, not `.` or
 * `..`), kept short. Anything else is never sent upstream.
 */
export function isBloodstarFolder(name: string): boolean {
	return (
		name.length > 0 &&
		name.length <= 120 &&
		name !== '.' &&
		name !== '..' &&
		// eslint-disable-next-line no-control-regex
		!/[/\\:"?<>|\u0000-\u001f]/.test(name)
	);
}

/** The script's name as its folder spells it, with spaces for the site's underscores. */
export function bloodstarName(edition: string): string {
	return edition.replace(/_+/g, ' ').trim();
}

/** The script's almanac page on the site: the page every row and saved script links to. */
export function bloodstarPage({ user, edition }: BloodstarScript): string {
	return `${BLOODSTAR_ORIGIN}/p/${encodeURIComponent(user)}/${encodeURIComponent(edition)}/almanac.html`;
}

export function bloodstarScriptPath({ user, edition }: BloodstarScript): string {
	return `${BLOODSTAR_API}/${encodeURIComponent(user)}/${encodeURIComponent(edition)}`;
}

/** Where the Worker fetches one script. */
export function bloodstarScriptUrl({ user, edition }: BloodstarScript): string {
	return `${BLOODSTAR_ORIGIN}/p/${encodeURIComponent(user)}/${encodeURIComponent(edition)}/script.json`;
}

function decode(part: string): string | undefined {
	try {
		return decodeURIComponent(part);
	} catch {
		return undefined;
	}
}

/** `/p/<user>/<edition>/...` (encoded or not), or undefined. */
function fromPath(path: string): BloodstarScript | undefined {
	const parts = path.split('/').filter(Boolean);
	if (parts[0] !== 'p' || parts.length < 3) return undefined;
	const user = decode(parts[1]);
	const edition = decode(parts[2]);
	if (!user || !edition || !isBloodstarFolder(user) || !isBloodstarFolder(edition)) {
		return undefined;
	}
	return { user, edition };
}

/**
 * A pasted Bloodstar link on either host: the script's folder, its `script.json` or its
 * `almanac.html`. Undefined for anything else.
 */
export function parseBloodstarLink(url: URL): BloodstarScript | undefined {
	if (!HOSTS.has(url.hostname.toLowerCase())) return undefined;
	return fromPath(url.pathname);
}

/** The site's `/api/allpublished.php` answer: one entry per folder with a `script.json`. */
export function readAllPublished(json: unknown): BloodstarScript[] {
	if (!Array.isArray(json)) return [];
	return json.flatMap((entry): BloodstarScript[] => {
		const paths = Array.isArray(entry) ? entry : [];
		const script = paths.find(
			(p): p is string => typeof p === 'string' && /\/script\.json$/.test(p)
		);
		if (!script) return [];
		// Paths come relative ("/p/…") or with the site's address in front.
		const found = fromPath(script.replace(/^https?:\/\/[^/]+/, ''));
		return found ? [found] : [];
	});
}

/** Our list answer as the page reads it back (also its copy kept on the device). */
export function readBloodstarList(json: unknown): BloodstarScript[] | undefined {
	if (typeof json !== 'object' || json === null || !('scripts' in json)) return undefined;
	const scripts = (json as { scripts: unknown }).scripts;
	if (!Array.isArray(scripts)) return undefined;
	return scripts.flatMap((row): BloodstarScript[] => {
		if (typeof row !== 'object' || row === null) return [];
		const { user, edition } = row as Record<string, unknown>;
		return typeof user === 'string' &&
			typeof edition === 'string' &&
			isBloodstarFolder(user) &&
			isBloodstarFolder(edition)
			? [{ user, edition }]
			: [];
	});
}
