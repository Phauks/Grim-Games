/**
 * Links to TPI's Script Tool (`https://script.bloodontheclocktower.com/?script=…`) carry the
 * whole script in the link: the JSON, gzipped, base64-encoded and URL-encoded (sometimes
 * twice, as on the official Scripts page). So they load without any request, offline too.
 * Also used by the Worker to read the official site's curated lists. Design: 08 §5.2.
 */

export const SCRIPT_TOOL_HOST = 'script.bloodontheclocktower.com';

/** A compressed script is far smaller than this; anything bigger is not one. */
const MAX_PAYLOAD_CHARS = 200_000;
/** The same limit as a script file (`MAX_SCRIPT_BYTES`). */
const MAX_SCRIPT_CHARS = 1_000_000;

/** `reason` lets the app show its own words; the message is English for logs and the Worker. */
export class ScriptToolLinkError extends Error {
	constructor(readonly reason: 'damaged' | 'tooLarge') {
		super(
			reason === 'tooLarge' ? 'That script is too large.' : 'This Script Tool link is damaged.'
		);
	}
}

/** The `script=` payload of a Script Tool link, or undefined for any other text. */
export function scriptToolPayload(text: string): string | undefined {
	let url: URL;
	try {
		url = new URL(text.trim());
	} catch {
		return undefined;
	}
	if (url.hostname.toLowerCase() !== SCRIPT_TOOL_HOST) return undefined;
	let payload = url.searchParams.get('script');
	if (!payload) return undefined;
	// Double-encoded links still hold %2B and the like after one decode.
	for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(payload); i++) {
		try {
			payload = decodeURIComponent(payload);
		} catch {
			return undefined;
		}
	}
	// A '+' that was never encoded arrives as a space.
	payload = payload.replace(/ /g, '+');
	return /^[A-Za-z0-9+/_-]+=*$/.test(payload) && payload.length <= MAX_PAYLOAD_CHARS
		? payload
		: undefined;
}

function base64Bytes(payload: string): Uint8Array {
	const standard = payload.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(standard + '='.repeat((4 - (standard.length % 4)) % 4));
	return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** The script JSON text inside a payload from `scriptToolPayload`. */
export async function decodeScriptToolPayload(payload: string): Promise<string> {
	let bytes: Uint8Array;
	try {
		bytes = base64Bytes(payload);
	} catch {
		throw new ScriptToolLinkError('damaged');
	}
	let text: string;
	try {
		const stream = new Blob([bytes.buffer as ArrayBuffer])
			.stream()
			.pipeThrough(new DecompressionStream('gzip'));
		text = await new Response(stream).text();
	} catch {
		throw new ScriptToolLinkError('damaged');
	}
	if (text.length > MAX_SCRIPT_CHARS) throw new ScriptToolLinkError('tooLarge');
	return text;
}

/** One script listed on the official Scripts page. */
export interface CuratedLink {
	/** The page section it is listed under: a `CuratedSection` id, or the heading as written. */
	section: string;
	/** The Script Tool link, entities decoded. */
	link: string;
}

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	'#39': "'"
};

function decodeEntities(text: string): string {
	return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
		const known = ENTITIES[name.toLowerCase()];
		if (known) return known;
		if (name.startsWith('#x') || name.startsWith('#X')) {
			return String.fromCodePoint(parseInt(name.slice(2), 16));
		}
		if (name.startsWith('#')) return String.fromCodePoint(parseInt(name.slice(1), 10));
		return whole;
	});
}

/** The page's known sections, which the app names in its own words (`scripts.curated.*`). */
export const CURATED_SECTIONS = ['month', 'recommended', 'teensyville'] as const;
export type CuratedSection = (typeof CURATED_SECTIONS)[number];

/** A known section's id; any other heading as written, in title case. */
function sectionLabel(heading: string): string {
	const upper = heading.toUpperCase();
	if (upper.includes('MONTH')) return 'month';
	if (upper.includes('RECOMMENDED')) return 'recommended';
	if (upper.includes('TEENSYVILLE')) return 'teensyville';
	return heading.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** At most this many links are read from the page. */
export const MAX_CURATED = 40;

/**
 * Every Script Tool link on the official Scripts page, with the `<h2>` section it sits
 * under. Reads only headings and link targets, so it survives changes to the page's
 * styling; the names and authors come from the scripts themselves.
 */
export function readCuratedPage(html: string): CuratedLink[] {
	const found: CuratedLink[] = [];
	const seen = new Set<string>();
	let section = '';
	const pattern = /<h2\b[^>]*>([\s\S]*?)<\/h2>|href\s*=\s*"([^"]+)"|href\s*=\s*'([^']+)'/gi;
	for (const match of html.matchAll(pattern)) {
		if (match[1] !== undefined) {
			const heading = decodeEntities(match[1].replace(/<[^>]*>/g, ' '))
				.replace(/\s+/g, ' ')
				.trim();
			if (heading) section = sectionLabel(heading);
			continue;
		}
		const link = decodeEntities(match[2] ?? match[3] ?? '');
		if (!scriptToolPayload(link) || seen.has(link)) continue;
		seen.add(link);
		found.push({ section: section || 'Scripts', link });
		if (found.length >= MAX_CURATED) break;
	}
	return found;
}
