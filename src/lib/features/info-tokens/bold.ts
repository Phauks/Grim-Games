/** A run of info-token text with its formatting. */
export interface TextRun {
	text: string;
	bold: boolean;
	italic: boolean;
}

type Piece = { text: string } | { stars: number };

/** Text and runs of `*` (a run of 4 is two bold markers; 5 or more is plain text). */
function lex(source: string): Piece[] {
	const pieces: Piece[] = [];
	for (const part of source.split(/(\*+)/)) {
		if (!part) continue;
		if (!part.startsWith('*') || part.length > 4) pieces.push({ text: part });
		else if (part.length === 4) pieces.push({ stars: 2 }, { stars: 2 });
		else pieces.push({ stars: part.length });
	}
	return pieces;
}

/**
 * Splits custom info-token text on `**bold**` and `*italic*` markers (`***both***`), which
 * the editor writes for the Storyteller (Trevor, 2026-10-16: no typing markers by hand).
 * Rendered as text nodes, never as HTML. A marker without its partner is kept as typed.
 */
export function parseRich(source: string): TextRun[] {
	const pieces = lex(source);
	// Which of each marker's roles (bold, italic) found a partner.
	const roles = pieces.map((p) =>
		'stars' in p
			? { bold: p.stars >= 2, italic: p.stars !== 2, boldOk: false, italicOk: false }
			: undefined
	);
	let boldOpen: number | undefined;
	let italicOpen: number | undefined;
	roles.forEach((role, i) => {
		if (!role) return;
		if (role.bold) {
			if (boldOpen === undefined) boldOpen = i;
			else {
				roles[boldOpen]!.boldOk = true;
				role.boldOk = true;
				boldOpen = undefined;
			}
		}
		if (role.italic) {
			if (italicOpen === undefined) italicOpen = i;
			else {
				roles[italicOpen]!.italicOk = true;
				role.italicOk = true;
				italicOpen = undefined;
			}
		}
	});

	const runs: TextRun[] = [];
	let bold = false;
	let italic = false;
	const push = (text: string) => {
		if (!text) return;
		const last = runs.at(-1);
		if (last && last.bold === bold && last.italic === italic) last.text += text;
		else runs.push({ text, bold, italic });
	};
	pieces.forEach((piece, i) => {
		const role = roles[i];
		if (!role) return push((piece as { text: string }).text);
		// Unpartnered markers stay as typed, as plain characters of the current style.
		push('*'.repeat((role.bold && !role.boldOk ? 2 : 0) + (role.italic && !role.italicOk ? 1 : 0)));
		if (role.boldOk) bold = !bold;
		if (role.italicOk) italic = !italic;
	});
	return runs;
}

/** Writes runs back as text with markers, the form custom info tokens are stored in. */
export function toSource(runs: readonly TextRun[]): string {
	return runs
		.map(({ text, bold, italic }) => {
			if (!text.trim()) return text;
			const mark = (bold ? '**' : '') + (italic ? '*' : '');
			// Markers hug the words; spaces at the edges stay outside them.
			const [, lead, body, trail] = /^(\s*)(.*?)(\s*)$/s.exec(text)!;
			return `${lead}${mark}${body}${mark.split('').reverse().join('')}${trail}`;
		})
		.join('');
}

/** The text without its markers, for labels and accessible names. */
export function plainText(source: string): string {
	return parseRich(source)
		.map((run) => run.text)
		.join('');
}
