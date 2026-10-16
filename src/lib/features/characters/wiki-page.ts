/**
 * Reads a character's wiki page (MediaWiki parse API HTML) into plain sections of text, so
 * the app can show the page in its own dialog without injecting the wiki's HTML. Only text is
 * kept: headings, paragraphs and list items. Tables, images, contents boxes and edit links
 * are dropped. Uses DOMParser, so it runs in the browser only.
 */

export type WikiBlock = { kind: 'p'; text: string } | { kind: 'list'; items: string[] };

export interface WikiSection {
	/** The section's heading on the wiki; '' for text before the first heading. */
	heading: string;
	blocks: WikiBlock[];
}

const SKIP =
	'table, style, script, figure, img, .toc, #toc, .infobox, .thumb, .navbox, .gallery, ' +
	'.mw-references-wrap, .reflist, .references, .noprint, .mw-empty-elt';
const NOISE = 'sup.reference, .mw-editsection, style, script';
const HEADING = /^H[2-6]$/;

function clean(el: Element): string {
	const copy = el.cloneNode(true) as Element;
	for (const n of copy.querySelectorAll(NOISE)) n.remove();
	return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function parseWikiPage(html: string): WikiSection[] {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const root = doc.querySelector('.mw-parser-output') ?? doc.body;
	const sections: WikiSection[] = [{ heading: '', blocks: [] }];
	const current = () => sections[sections.length - 1];

	const walk = (parent: Element) => {
		for (const el of parent.children) {
			if (el.matches(SKIP)) continue;
			const heading = HEADING.test(el.tagName)
				? el
				: el.matches('.mw-heading')
					? el.querySelector('h2, h3, h4, h5, h6')
					: null;
			if (heading) {
				sections.push({ heading: clean(heading), blocks: [] });
			} else if (el.tagName === 'P' || el.tagName === 'BLOCKQUOTE') {
				const text = clean(el);
				if (text) current().blocks.push({ kind: 'p', text });
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
	return sections.filter((s) => s.blocks.length > 0);
}

/** The wiki page title in a character's wiki URL (the last path segment). */
export function wikiPageTitle(url: string): string {
	return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
}
