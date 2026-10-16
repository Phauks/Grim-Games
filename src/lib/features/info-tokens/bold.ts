/**
 * Text colours a Storyteller can give words on a card, separate from bold and italic
 * (Trevor, 2026-10-16). Each maps to a theme token, so every theme colours it.
 */
export const INK_COLORS = ['red', 'blue', 'purple', 'gold', 'green'] as const;
export type InkColor = (typeof INK_COLORS)[number];

/** The theme token each colour is drawn with. */
export const INK_TOKENS: Record<InkColor, string> = {
	red: 'var(--evil)',
	blue: 'var(--good)',
	purple: 'var(--traveller)',
	gold: 'var(--heading)',
	green: 'var(--leaf)'
};

/** A run of info-token text with its formatting. */
export interface TextRun {
	text: string;
	bold: boolean;
	italic: boolean;
	color?: InkColor;
}

type Piece = { text: string } | { stars: number } | { open: InkColor } | { close: InkColor };

const TAG = new RegExp(`(\\*+|\\[\\/?(?:${INK_COLORS.join('|')})\\])`);

/**
 * Text, runs of `*` (a run of 4 is two bold markers; 5 or more is plain text) and colour
 * tags (`[red]` … `[/red]`).
 */
function lex(source: string): Piece[] {
	const pieces: Piece[] = [];
	// Splitting on one capture group puts the markers and tags at the odd places.
	source.split(TAG).forEach((part, i) => {
		if (!part) return;
		if (i % 2 === 0) pieces.push({ text: part });
		else if (part.startsWith('[/')) pieces.push({ close: part.slice(2, -1) as InkColor });
		else if (part.startsWith('[')) pieces.push({ open: part.slice(1, -1) as InkColor });
		else if (part.length > 4) pieces.push({ text: part });
		else if (part.length === 4) pieces.push({ stars: 2 }, { stars: 2 });
		else pieces.push({ stars: part.length });
	});
	return pieces;
}

/** Which colour tags have a partner: an open tag pairs with the next close of its colour. */
function pairColors(pieces: readonly Piece[]): Set<number> {
	const paired = new Set<number>();
	let open: number | undefined;
	pieces.forEach((piece, i) => {
		if ('open' in piece) open = i;
		else if ('close' in piece && open !== undefined) {
			if ((pieces[open] as { open: InkColor }).open !== piece.close) return;
			paired.add(open).add(i);
			open = undefined;
		}
	});
	return paired;
}

/**
 * Splits custom info-token text on `**bold**` and `*italic*` markers (`***both***`) and
 * `[red]colour[/red]` tags, which the editor writes for the Storyteller (Trevor, 2026-10-16:
 * no typing markers by hand). Rendered as text nodes, never as HTML. A marker or tag
 * without its partner is kept as typed.
 */
export function parseRich(source: string): TextRun[] {
	const pieces = lex(source);
	const colorsPaired = pairColors(pieces);
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
	let color: InkColor | undefined;
	const push = (text: string) => {
		if (!text) return;
		const last = runs.at(-1);
		if (last && last.bold === bold && last.italic === italic && last.color === color)
			last.text += text;
		else runs.push({ text, bold, italic, ...(color ? { color } : {}) });
	};
	pieces.forEach((piece, i) => {
		if ('open' in piece || 'close' in piece) {
			if (!colorsPaired.has(i))
				return push('open' in piece ? `[${piece.open}]` : `[/${piece.close}]`);
			color = 'open' in piece ? piece.open : undefined;
			return;
		}
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
		.map(({ text, bold, italic, color }) => {
			if (!text.trim()) return text;
			const mark = (bold ? '**' : '') + (italic ? '*' : '');
			// Markers hug the words; spaces at the edges stay outside them.
			const [, lead, body, trail] = /^(\s*)(.*?)(\s*)$/s.exec(text)!;
			const marked = `${mark}${body}${mark.split('').reverse().join('')}`;
			return `${lead}${color ? `[${color}]${marked}[/${color}]` : marked}${trail}`;
		})
		.join('');
}

/** The text without its markers, for labels and accessible names. */
export function plainText(source: string): string {
	return parseRich(source)
		.map((run) => run.text)
		.join('');
}

/**
 * Version 1 cards drew `**bold**` as red text, not heavier type (Trevor, 2026-10-16), so
 * they become red text and keep their look; italic stays italic.
 */
export function boldToRed(source: string): string {
	return toSource(
		parseRich(source).map((run) =>
			run.bold ? { ...run, bold: false, color: run.color ?? 'red' } : run
		)
	);
}
