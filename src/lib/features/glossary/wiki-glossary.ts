import { WIKI_ORIGIN } from '#lib/core/data/wiki.ts';

/** A run of an entry's text; `href` when the wiki makes it a link (such as "see Drunk"). */
export interface WikiTextPart {
	text: string;
	href?: string;
}

export interface WikiEntry {
	/** The entry's name as the wiki writes it. */
	name: string;
	parts: WikiTextPart[];
}

const NOISE = 'sup.reference, .mw-editsection, style, script';

/** The text of an element as runs, keeping where its links point. */
function partsOf(el: Element, base: string): WikiTextPart[] {
	const out: WikiTextPart[] = [];
	const push = (text: string, href?: string) => {
		const last = out[out.length - 1];
		if (last && !last.href && !href) last.text += text;
		else out.push(href ? { text, href } : { text });
	};
	const walk = (node: Node) => {
		for (const child of node.childNodes) {
			if (child.nodeType === Node.TEXT_NODE) push(child.textContent ?? '');
			else if (child instanceof Element) {
				if (child.matches(NOISE)) continue;
				const href = child.tagName === 'A' ? child.getAttribute('href') : null;
				if (href && !href.startsWith('#cite')) {
					push(child.textContent ?? '', new URL(href, `${base}/`).href);
				} else walk(child);
			}
		}
	};
	walk(el);
	// Collapse spacing as the page shows it, and trim the ends.
	for (const p of out) p.text = p.text.replace(/\s+/g, ' ');
	if (out.length) {
		out[0].text = out[0].text.trimStart();
		out[out.length - 1].text = out[out.length - 1].text.trimEnd();
	}
	return out.filter((p) => p.text);
}

/** The runs after the first `offset` characters. */
function sliceParts(parts: WikiTextPart[], offset: number): WikiTextPart[] {
	const out: WikiTextPart[] = [];
	let at = 0;
	for (const p of parts) {
		const end = at + p.text.length;
		if (end > offset) out.push({ ...p, text: p.text.slice(Math.max(0, offset - at)) });
		at = end;
	}
	if (out.length) out[0].text = out[0].text.trimStart();
	return out.filter((p) => p.text);
}

export const entryText = (entry: WikiEntry) => entry.parts.map((p) => p.text).join('');

/**
 * Reads entries out of the rendered wiki Glossary page. Each entry is a block that starts
 * with its name and a colon ("Term: what it means"), or a dt/dd pair. Links in the text are
 * kept, so a "see …" reference can be followed. Pure DOM reading, so it can be tested on a
 * made-up page; the wiki's own text is never stored in the repo.
 */
export function parseGlossaryHtml(html: string, base = WIKI_ORIGIN): Map<string, WikiEntry> {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const entries = new Map<string, WikiEntry>();
	const add = (name: string, parts: WikiTextPart[]) => {
		const clean = name.replace(/\s+/g, ' ').trim();
		const key = glossaryKey(clean);
		if (key && parts.length && !entries.has(key)) entries.set(key, { name: clean, parts });
	};
	for (const dt of doc.querySelectorAll('dt')) {
		const dd = dt.nextElementSibling;
		if (dd?.tagName === 'DD') add(dt.textContent ?? '', partsOf(dd, base));
	}
	for (const block of doc.querySelectorAll('p, li, dd')) {
		const parts = partsOf(block, base);
		const text = parts.map((p) => p.text).join('');
		const match = /^([^:]{1,40}):\s*/.exec(text);
		if (match && match[0].length < text.length) add(match[1], sliceParts(parts, match[0].length));
	}
	return entries;
}

/** How entries are looked up: case and spacing do not matter. */
export function glossaryKey(name: string): string {
	return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

export type LinkTarget =
	| { kind: 'term'; key: string }
	| { kind: 'character'; name: string }
	| { kind: 'page'; url: string };

/**
 * Where a link in a Glossary entry goes (Trevor, 2026-10-16: "if glossary says see (drunk) or
 * another page, link it"): another Glossary entry opens in the same popover, a character
 * shows as its badge, anything else opens on the wiki.
 */
export function linkTarget(
	href: string,
	entries: ReadonlyMap<string, WikiEntry>,
	characterNames: readonly string[]
): LinkTarget {
	let url: URL;
	try {
		url = new URL(href);
	} catch {
		return { kind: 'page', url: href };
	}
	if (url.origin !== WIKI_ORIGIN) return { kind: 'page', url: href };
	const raw = url.searchParams.get('title') ?? url.pathname.replace(/^\/(index\.php\/?)?/, '');
	const title = decodeURIComponent(raw).replace(/_/g, ' ').trim();
	const fragment = decodeURIComponent(url.hash.slice(1)).replace(/_/g, ' ');
	if (title.toLowerCase() === 'glossary' && entries.has(glossaryKey(fragment)))
		return { kind: 'term', key: glossaryKey(fragment) };
	const character = characterNames.find((n) => n.toLowerCase() === title.toLowerCase());
	if (character) return { kind: 'character', name: character };
	if (!url.hash && entries.has(glossaryKey(title)))
		return { kind: 'term', key: glossaryKey(title) };
	return { kind: 'page', url: url.href };
}
