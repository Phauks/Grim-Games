/**
 * Reads a character's wiki page (MediaWiki parse API HTML) into plain sections of text, so
 * the app can show the page in its own dialog without injecting the wiki's HTML. Only text is
 * kept: headings, paragraphs and list items. Tables, images, contents boxes and edit links
 * are dropped. Uses DOMParser, so it runs in the browser only.
 */

export type WikiBlock =
	| { kind: 'p'; text: string }
	| { kind: 'list'; items: string[] }
	/** The character's flavour quote, from the page's details box. */
	| { kind: 'quote'; text: string }
	/** The artist credit from the details box. */
	| { kind: 'artist'; name: string }
	/** One worked example (the wiki's `div.example`). */
	| { kind: 'example'; text: string };

export interface WikiSection {
	/** The section's heading on the wiki; '' for text before the first heading. */
	heading: string;
	blocks: WikiBlock[];
}

// #jinxes: the wiki's "Related Jinxes (Open)" box above the Summary; the Jinxes section shows
// TPI's jinxes instead (Trevor, 2026-10-16: remove that text).
const SKIP =
	'table, style, script, figure, img, .toc, #toc, .infobox, .thumb, .navbox, .gallery, ' +
	'.mw-references-wrap, .reflist, .references, .noprint, .mw-empty-elt, #jinxes';
const NOISE = 'sup.reference, .mw-editsection, style, script';
const HEADING = /^H[2-6]$/;
/** Lines from the details box that are not shown: its own labels and the episode credit. */
const DROPPED = /^(Information|Appears in)\b/i;
/** A line that states the character's optional rule ("Optional rule: …"). */
const OPTIONAL_RULE = /^Optional rule\b/i;
/** The wiki's own words for it, as the section's heading. */
export const OPTIONAL_RULE_HEADING = 'Optional rule';

function clean(el: Element): string {
	const copy = el.cloneNode(true) as Element;
	for (const n of copy.querySelectorAll(NOISE)) n.remove();
	return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * The details box at the top of a character page: only the flavour quote and the artist are
 * kept. Its "Information" label, the type table, the "Appears in" line (editions and
 * podcast episode) and the audio player are left out (Trevor, 2026-10-16).
 */
function details(box: Element): WikiBlock[] {
	const blocks: WikiBlock[] = [];
	const quote = box.querySelector('.flavour');
	const text = quote ? clean(quote) : '';
	if (text) blocks.push({ kind: 'quote', text });
	for (const row of box.querySelectorAll('tr')) {
		const cells = [...row.querySelectorAll('td, th')].map(clean);
		const at = cells.findIndex((cell) => /^artist$/i.test(cell));
		if (at >= 0 && cells[at + 1]) blocks.push({ kind: 'artist', name: cells[at + 1] });
	}
	return blocks;
}

export function parseWikiPage(html: string): WikiSection[] {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const root = doc.querySelector('.mw-parser-output') ?? doc.body;
	const sections: WikiSection[] = [{ heading: '', blocks: [] }];
	const current = () => sections[sections.length - 1];
	// A character's optional rule, wherever the page puts it (an example box, a paragraph), in a
	// section of its own at the end (Trevor, 2026-10-31).
	const optional: WikiBlock[] = [];
	const add = (block: WikiBlock & { text: string }) => {
		if (OPTIONAL_RULE.test(block.text)) optional.push({ kind: 'p', text: block.text });
		else current().blocks.push(block);
	};

	const walk = (parent: Element) => {
		for (const el of parent.children) {
			if (el.id === 'character-details') {
				current().blocks.push(...details(el));
				continue;
			}
			if (el.matches(SKIP)) continue;
			const heading = HEADING.test(el.tagName)
				? el
				: el.matches('.mw-heading')
					? el.querySelector('h2, h3, h4, h5, h6')
					: null;
			if (heading) {
				sections.push({ heading: clean(heading), blocks: [] });
			} else if (el.matches('.example')) {
				const text = clean(el);
				if (text) add({ kind: 'example', text });
			} else if (el.tagName === 'P' || el.tagName === 'BLOCKQUOTE') {
				const text = clean(el);
				if (text && !DROPPED.test(text)) add({ kind: 'p', text });
			} else if (el.tagName === 'UL' || el.tagName === 'OL') {
				const items = [...el.children]
					.filter((li) => li.tagName === 'LI')
					.map(clean)
					.filter(Boolean);
				if (items.length) current().blocks.push({ kind: 'list', items });
			} else if (el.tagName === 'DL') {
				for (const item of el.children) {
					const text = clean(item);
					if (text) current().blocks.push({ kind: 'p', text });
				}
			} else if (el.tagName === 'DIV' || el.tagName === 'SECTION') {
				walk(el);
			}
		}
	};
	walk(root);
	if (optional.length > 0) sections.push({ heading: OPTIONAL_RULE_HEADING, blocks: optional });
	return sections.filter((s) => s.blocks.length > 0);
}

/**
 * A character's optional rule in its parsed page, in the wiki's words: its "Optional rule"
 * section, or else a tip that names one (the Pit-Hag's Travellers,
 * https://wiki.bloodontheclocktower.com/Pit-Hag). Undefined when the page has neither.
 */
export function optionalRuleIn(sections: readonly WikiSection[]): string | undefined {
	const section = sections.find((s) => s.heading === OPTIONAL_RULE_HEADING);
	const text = section?.blocks
		.flatMap((b) => (b.kind === 'p' || b.kind === 'example' ? [b.text] : []))
		.join(' ');
	if (text) return text;
	for (const s of sections)
		for (const block of s.blocks) {
			const lines = block.kind === 'list' ? block.items : 'text' in block ? [block.text] : [];
			const line = lines.find((l) => /\boptional rule\b/i.test(l));
			if (line) return line;
		}
	return undefined;
}

/** The wiki page title in a character's wiki URL (the last path segment). */
export function wikiPageTitle(url: string): string {
	return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
}

/** Text compared without case, spacing, quote marks, brackets or the night asterisk. */
const normalise = (text: string) =>
	text
		.toLowerCase()
		.replace(/["'“”‘’()[\]{}*]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[.\s]+$/, '');

/**
 * The wiki's standard lead-in to a Bluffing section ("When bluffing as the X, there are a
 * few things you should keep in mind:"); the numbered boxes make it redundant.
 */
const BLUFFING_LEAD_IN =
	/^when bluffing as (the )?.+, there are a few things you should keep in mind:?$/i;

/**
 * A section without what the dialog already shows: the character's ability, which the
 * Summary repeats word for word under the dialog's own header, and the Bluffing lead-in
 * (Trevor, 2026-10-16). Wording that differs at all from the ability is kept.
 */
export function withoutRepeats(section: WikiSection, ability: string): WikiSection {
	const own = normalise(ability);
	const blocks = section.blocks.filter(
		(block) =>
			block.kind !== 'p' || (normalise(block.text) !== own && !BLUFFING_LEAD_IN.test(block.text))
	);
	return blocks.length === section.blocks.length ? section : { ...section, blocks };
}
