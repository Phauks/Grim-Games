/**
 * Script JSON as people write it by hand (JSON5-style): `//` and `/* *\/` comments and
 * trailing commas are dropped, so a hand-edited script still loads. Text inside strings is
 * never touched. Text that is already valid JSON comes back unchanged.
 */
export function relaxJson(text: string): string {
	try {
		JSON.parse(text);
		return text;
	} catch {
		// Not strict JSON: tidy it below.
	}
	let out = '';
	let i = 0;
	while (i < text.length) {
		const c = text[i];
		if (c === '"') {
			const end = stringEnd(text, i);
			out += text.slice(i, end);
			i = end;
		} else if (c === '/' && text[i + 1] === '/') {
			while (i < text.length && text[i] !== '\n') i++;
		} else if (c === '/' && text[i + 1] === '*') {
			const close = text.indexOf('*/', i + 2);
			i = close === -1 ? text.length : close + 2;
		} else if (c === ',' && closesNext(text, i + 1)) {
			i++;
		} else {
			out += c;
			i++;
		}
	}
	return out;
}

/** The index just past the string that opens at `start`. */
function stringEnd(text: string, start: number): number {
	let i = start + 1;
	while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
	return Math.min(i + 1, text.length);
}

/** Whether only spaces and comments come before the next `]` or `}` from `from`. */
function closesNext(text: string, from: number): boolean {
	let i = from;
	while (i < text.length) {
		const c = text[i];
		if (/\s/.test(c)) i++;
		else if (c === '/' && text[i + 1] === '/') {
			while (i < text.length && text[i] !== '\n') i++;
		} else if (c === '/' && text[i + 1] === '*') {
			const close = text.indexOf('*/', i + 2);
			if (close === -1) return false;
			i = close + 2;
		} else return c === ']' || c === '}';
	}
	return false;
}
