/**
 * Reads entries out of the rendered wiki Glossary page. Each entry is a block that starts
 * with its name and a colon ("Term: what it means"), or a dt/dd pair. Pure DOM reading,
 * so it can be tested on a made-up page; the wiki's own text is never stored in the repo.
 */
export function parseGlossaryHtml(html: string): Map<string, string> {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const entries = new Map<string, string>();
	const add = (name: string, text: string) => {
		const key = glossaryKey(name);
		const value = text.replace(/\s+/g, ' ').trim();
		if (key && value && !entries.has(key)) entries.set(key, value);
	};
	for (const dt of doc.querySelectorAll('dt')) {
		const dd = dt.nextElementSibling;
		if (dd?.tagName === 'DD') add(dt.textContent ?? '', dd.textContent ?? '');
	}
	for (const block of doc.querySelectorAll('p, li, dd')) {
		const text = (block.textContent ?? '').replace(/\s+/g, ' ').trim();
		const match = /^([^:]{1,40}):\s*(.+)$/.exec(text);
		if (match) add(match[1], match[2]);
	}
	return entries;
}

/** How entries are looked up: case and spacing do not matter. */
export function glossaryKey(name: string): string {
	return name.replace(/\s+/g, ' ').trim().toLowerCase();
}
