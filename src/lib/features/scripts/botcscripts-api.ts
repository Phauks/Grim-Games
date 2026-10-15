/**
 * BotC Scripts (botcscripts.com) lookups, shared by the browser and the Worker proxy.
 *
 * Plain TypeScript with no imports: the Worker (`worker/botcscripts.ts`) compiles this file
 * too. API shape from the site's source, AdmiralGT/botc-scripts @ 8ca42e6:
 * - `GET /api/script_ids/<script pk>/` → `{ pk, name, versions: { "1.0.0": <version URL> },
 *   latest_version: <version URL> }` (`scripts/serializers.py` ScriptSerializer)
 * - `GET /api/scripts/<version pk>/` → `{ pk, script_id, name, version, script_type, author,
 *   content, score }` (VersionSerializer)
 * Browsers can't call it from other sites (botc-scripts issue 420: CORS is allow-listed),
 * so the app goes through `/api/botcscripts/...` on our Worker.
 * Design: 08-script-loading.md §4.
 */

export const BOTC_SCRIPTS_ORIGIN = 'https://botcscripts.com';

/** Which BotC Scripts entry to load: a script (latest or one version) or a version by its pk. */
export type BotcScriptsRef =
	{ kind: 'script'; scriptId: number; version?: string } | { kind: 'version'; versionId: number };

/** One loaded script version, as our Worker returns it. */
export interface BotcScriptsVersion {
	scriptId: number;
	versionId: number;
	name: string;
	version: string;
	author: string;
	/** The script JSON, exactly as uploaded. */
	content: unknown;
}

const ID = /^\d{1,9}$/;
/** Version labels on the site look like "1.0.0"; keep them to safe path characters. */
const VERSION = /^[\w.-]{1,32}$/;

/**
 * Reads a BotC Scripts reference from what the Storyteller pasted: a script number, a
 * script page link (`/script/123` or `/script/123/1.0.0`, plus anything after it such as
 * `/download`), or an API link (`/api/scripts/6669/json/`, the site's "JSON" button).
 */
export function parseBotcScriptsRef(input: string): BotcScriptsRef | undefined {
	const text = input.trim();
	if (ID.test(text)) return { kind: 'script', scriptId: Number(text) };
	let url: URL;
	try {
		url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
	} catch {
		return undefined;
	}
	if (!/^(www\.)?botcscripts\.com$/i.test(url.hostname)) return undefined;
	const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
	if (parts[0] === 'api' && parts[1] === 'scripts' && ID.test(parts[2] ?? '')) {
		return { kind: 'version', versionId: Number(parts[2]) };
	}
	if (parts[0] === 'script' && ID.test(parts[1] ?? '')) {
		const version = parts[2];
		return version && VERSION.test(version)
			? { kind: 'script', scriptId: Number(parts[1]), version }
			: { kind: 'script', scriptId: Number(parts[1]) };
	}
	return undefined;
}

/** Our Worker's path for a reference. Path only: nothing goes in a query string. */
export function proxyPath(ref: BotcScriptsRef): string {
	if (ref.kind === 'version') return `/api/botcscripts/version/${ref.versionId}`;
	const version = ref.version ? `/${encodeURIComponent(ref.version)}` : '';
	return `/api/botcscripts/script/${ref.scriptId}${version}`;
}

/** The reverse of `proxyPath`, for the Worker. Undefined for anything else. */
export function parseProxyPath(pathname: string): BotcScriptsRef | undefined {
	const match = /^\/api\/botcscripts\/(script|version)\/(\d{1,9})(?:\/([^/]+))?\/?$/.exec(pathname);
	if (!match) return undefined;
	const id = Number(match[2]);
	if (match[1] === 'version') return match[3] ? undefined : { kind: 'version', versionId: id };
	if (!match[3]) return { kind: 'script', scriptId: id };
	const version = decodeURIComponent(match[3]);
	return VERSION.test(version) ? { kind: 'script', scriptId: id, version } : undefined;
}

/** The public page for a script, for "from BotC Scripts" links. */
export function scriptPageUrl(scriptId: number, version?: string): string {
	return `${BOTC_SCRIPTS_ORIGIN}/script/${scriptId}${version ? `/${encodeURIComponent(version)}` : ''}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The version pk at the end of a version URL such as `http://botcscripts.com/api/scripts/6669/`. */
function versionIdFromUrl(value: unknown): number | undefined {
	if (typeof value !== 'string') return undefined;
	const match = /\/api\/scripts\/(\d{1,9})\/?$/.exec(value);
	return match ? Number(match[1]) : undefined;
}

/**
 * Picks the version to load from a `/api/script_ids/<pk>/` response: the requested version,
 * or the latest. Undefined when that version doesn't exist.
 */
export function pickVersionId(json: unknown, version?: string): number | undefined {
	if (!isObject(json)) return undefined;
	if (version === undefined) return versionIdFromUrl(json.latest_version);
	return isObject(json.versions) ? versionIdFromUrl(json.versions[version]) : undefined;
}

/** Reads a `/api/scripts/<version pk>/` response. Undefined when it isn't one. */
export function readVersion(json: unknown): BotcScriptsVersion | undefined {
	if (!isObject(json)) return undefined;
	const { pk, script_id, name, version, author, content } = json;
	if (typeof pk !== 'number' || typeof script_id !== 'number') return undefined;
	if (!Array.isArray(content) && !isObject(content)) return undefined;
	return {
		scriptId: script_id,
		versionId: pk,
		name: typeof name === 'string' ? name : '',
		version: typeof version === 'string' ? version : String(version ?? ''),
		author: typeof author === 'string' ? author : '',
		content
	};
}

/** Reads our Worker's response (a `BotcScriptsVersion`). Undefined when it isn't one. */
export function readProxiedVersion(json: unknown): BotcScriptsVersion | undefined {
	if (!isObject(json)) return undefined;
	const { scriptId, versionId, name, version, author, content } = json;
	if (typeof scriptId !== 'number' || typeof versionId !== 'number') return undefined;
	if (typeof name !== 'string' || typeof version !== 'string' || typeof author !== 'string') {
		return undefined;
	}
	if (!Array.isArray(content) && !isObject(content)) return undefined;
	return { scriptId, versionId, name, version, author, content };
}
