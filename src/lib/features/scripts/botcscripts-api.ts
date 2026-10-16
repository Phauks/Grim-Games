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

/** One character entry of a search result, as the script lists it. */
export interface BotcScriptsEntry {
	id: string;
	/** Set for homebrew entries, which carry their own name and team. */
	name?: string;
	team?: string;
}

/** One search result: enough to show a card and load that version. */
export interface BotcScriptsSummary {
	scriptId: number;
	versionId: number;
	name: string;
	version: string;
	author: string;
	/** "Full" or "Teensyville" on the site. */
	type: string;
	/** Votes on the site. */
	score: number;
	/** The script's characters (no abilities or night text), for counts and details. */
	characters: BotcScriptsEntry[];
}

export interface BotcScriptsSearchPage {
	page: number;
	/** Matching scripts in total, across pages. */
	count: number;
	hasMore: boolean;
	results: BotcScriptsSummary[];
}

/**
 * Sort orders the site's API supports (`ordering_fields = ["pk", "score"]` in
 * AdmiralGT/botc-scripts `scripts/viewsets.py`): votes, upload order, or, with a search
 * term, how closely the name matches. Sorting by name is not offered by the site.
 */
export const BOTC_SORTS = ['votes', 'newest', 'oldest', 'match'] as const;
export type BotcScriptsSort = (typeof BOTC_SORTS)[number];

/**
 * Which characters a script may use, as the site's `edition` filter counts it
 * (`scripts/models.py` Edition): each step includes the ones before.
 */
export const BOTC_EDITIONS = [0, 1, 2] as const;

/** A search with filters (`scripts/filters.py` ScriptVersionFilter on the site). */
export interface BotcScriptsQuery {
	term: string;
	sort: BotcScriptsSort;
	/** "Full" or "Teensyville"; '' for both. */
	type: '' | 'Full' | 'Teensyville';
	/** Character ids every result must have / must not have. */
	include: string[];
	exclude: string[];
	/** See `BOTC_EDITIONS`; undefined for any. */
	edition?: number;
	author: string;
	/** Exactly one Demon. */
	oneDemon: boolean;
	/** No homebrew or hybrid scripts. */
	officialOnly: boolean;
}

export const EMPTY_QUERY: BotcScriptsQuery = {
	term: '',
	sort: 'votes',
	type: '',
	include: [],
	exclude: [],
	author: '',
	oneDemon: false,
	officialOnly: false
};

/** The site's own limit on search terms is generous; Pocket Grimoire sent at most 100. */
export const MAX_SEARCH_LENGTH = 100;
const MAX_PAGE = 100;
/** Characters per include or exclude list. */
export const MAX_FILTER_CHARACTERS = 10;
const CHARACTER_ID = /^[a-z0-9_-]{1,40}$/;

/** Trims, collapses spaces and caps a search term. */
export function normaliseSearch(term: string): string {
	return term.trim().replace(/\s+/g, ' ').slice(0, MAX_SEARCH_LENGTH);
}

function characterList(ids: readonly string[]): string[] {
	return [...new Set(ids.map((id) => id.toLowerCase()).filter((id) => CHARACTER_ID.test(id)))]
		.sort()
		.slice(0, MAX_FILTER_CHARACTERS);
}

/** Same query in one canonical form, so equal searches share one cache entry. */
export function normaliseQuery(query: BotcScriptsQuery): BotcScriptsQuery {
	const term = normaliseSearch(query.term);
	const edition = BOTC_EDITIONS.some((e) => e === query.edition) ? query.edition : undefined;
	return {
		term,
		// "Best match" needs a term; without one it means the default order.
		sort:
			BOTC_SORTS.includes(query.sort) && (term || query.sort !== 'match') ? query.sort : 'votes',
		type: query.type === 'Full' || query.type === 'Teensyville' ? query.type : '',
		include: characterList(query.include),
		exclude: characterList(query.exclude),
		...(edition === undefined ? {} : { edition }),
		author: normaliseSearch(query.author),
		oneDemon: query.oneDemon === true,
		officialOnly: query.officialOnly === true
	};
}

/** How many filters (not the term or sort) are set, for the Filters button. */
export function filterCount(query: BotcScriptsQuery): number {
	const q = normaliseQuery(query);
	return (
		(q.type ? 1 : 0) +
		q.include.length +
		q.exclude.length +
		(q.edition === undefined ? 0 : 1) +
		(q.author ? 1 : 0) +
		(q.oneDemon ? 1 : 0) +
		(q.officialOnly ? 1 : 0)
	);
}

/**
 * Our Worker's URL for a search page. Search filters are public, so they travel in the
 * query string (nothing private does, CLAUDE.md).
 */
export function searchPath(query: BotcScriptsQuery, page = 1): string {
	const q = normaliseQuery(query);
	const params = new URLSearchParams({ page: String(page) });
	if (q.term) params.set('q', q.term);
	if (q.sort !== 'votes') params.set('sort', q.sort);
	if (q.type) params.set('type', q.type);
	if (q.include.length) params.set('include', q.include.join(','));
	if (q.exclude.length) params.set('exclude', q.exclude.join(','));
	if (q.edition !== undefined) params.set('edition', String(q.edition));
	if (q.author) params.set('author', q.author);
	if (q.oneDemon) params.set('oneDemon', '1');
	if (q.officialOnly) params.set('official', '1');
	return `/api/botcscripts/search?${params}`;
}

/** The reverse of `searchPath`, for the Worker. Undefined for anything else. */
export function parseSearchUrl(url: URL): { query: BotcScriptsQuery; page: number } | undefined {
	if (url.pathname !== '/api/botcscripts/search') return undefined;
	const p = url.searchParams;
	const page = Number(p.get('page') ?? '1');
	if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) return undefined;
	const list = (name: string) => (p.get(name) ?? '').split(',').filter(Boolean);
	const edition = p.get('edition');
	return {
		page,
		query: normaliseQuery({
			term: p.get('q') ?? '',
			sort: (p.get('sort') ?? 'votes') as BotcScriptsSort,
			type: (p.get('type') ?? '') as BotcScriptsQuery['type'],
			include: list('include'),
			exclude: list('exclude'),
			edition: edition === null ? undefined : Number(edition),
			author: p.get('author') ?? '',
			oneDemon: p.get('oneDemon') === '1',
			officialOnly: p.get('official') === '1'
		})
	};
}

const ORDERING: Record<BotcScriptsSort, string | undefined> = {
	votes: '-score',
	newest: '-pk',
	oldest: 'pk',
	// No ordering: the site then sorts a search by name similarity.
	match: undefined
};

/** The site's search URL for a page of the latest versions. */
export function upstreamSearchPath(query: BotcScriptsQuery, page: number): string {
	const q = normaliseQuery(query);
	const params = new URLSearchParams({ latest: 'true', page: String(page) });
	const ordering = ORDERING[q.sort];
	if (ordering) params.set('ordering', ordering);
	if (q.term) params.set('search', q.term);
	if (q.type) params.set('script_type', q.type);
	if (q.include.length) params.set('include', q.include.join(','));
	if (q.exclude.length) params.set('exclude', q.exclude.join(','));
	if (q.edition !== undefined) params.set('edition', String(q.edition));
	if (q.author) params.set('author', q.author);
	if (q.oneDemon) params.set('mono_demon', 'true');
	if (q.officialOnly) {
		params.set('include_homebrew', 'false');
		params.set('include_hybrid', 'false');
	}
	return `/api/scripts/?${params}`;
}

const MAX_ENTRIES = 60;

/** The character entries of a script's JSON, without `_meta`, abilities or night text. */
export function readEntries(content: unknown): BotcScriptsEntry[] {
	if (!Array.isArray(content)) return [];
	const entries: BotcScriptsEntry[] = [];
	for (const item of content) {
		if (entries.length >= MAX_ENTRIES) break;
		if (typeof item === 'string') entries.push({ id: item.slice(0, 40) });
		else if (isObject(item) && typeof item.id === 'string' && item.id !== '_meta') {
			const entry: BotcScriptsEntry = { id: item.id.slice(0, 40) };
			if (typeof item.name === 'string') entry.name = item.name.slice(0, 60);
			if (typeof item.team === 'string') entry.team = item.team.slice(0, 20);
			entries.push(entry);
		}
	}
	return entries;
}

/** Reads a `/api/scripts/?…` page into slim rows (character ids, not the script JSON). */
export function readSearchPage(json: unknown, page: number): BotcScriptsSearchPage | undefined {
	if (!isObject(json) || !Array.isArray(json.results)) return undefined;
	const results: BotcScriptsSummary[] = [];
	for (const row of json.results) {
		if (!isObject(row) || typeof row.pk !== 'number' || typeof row.script_id !== 'number') continue;
		results.push({
			scriptId: row.script_id,
			versionId: row.pk,
			name: typeof row.name === 'string' ? row.name : '',
			version: typeof row.version === 'string' ? row.version : String(row.version ?? ''),
			author: typeof row.author === 'string' ? row.author : '',
			type: typeof row.script_type === 'string' ? row.script_type : '',
			score: typeof row.score === 'number' ? row.score : 0,
			characters: readEntries(row.content)
		});
	}
	return {
		page,
		count: typeof json.count === 'number' ? json.count : results.length,
		hasMore: typeof json.next === 'string' && json.next !== '',
		results
	};
}

/** Reads our Worker's search response. Undefined when it isn't one. */
export function readProxiedSearchPage(json: unknown): BotcScriptsSearchPage | undefined {
	if (!isObject(json) || !Array.isArray(json.results)) return undefined;
	if (typeof json.page !== 'number' || typeof json.count !== 'number') return undefined;
	const results = json.results
		.filter(
			(r): r is BotcScriptsSummary =>
				isObject(r) &&
				typeof r.scriptId === 'number' &&
				typeof r.versionId === 'number' &&
				typeof r.name === 'string'
		)
		.map((r) => ({ ...r, characters: Array.isArray(r.characters) ? r.characters : [] }));
	return { page: json.page, count: json.count, hasMore: json.hasMore === true, results };
}
