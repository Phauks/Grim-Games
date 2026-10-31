/**
 * Text colours a Storyteller can give words on a card, separate from bold and italic
 * (Trevor, 2026-10-16). Each maps to a theme token, so every theme colours it.
 */
export const INK_COLORS = ['red', 'blue', 'purple', 'gold', 'green'] as const;
export type InkColor = (typeof INK_COLORS)[number];

/** The theme token each colour is drawn with. */
export const INK_TOKENS: Record<InkColor, string> = {
	red: 'var(--evil-text)',
	blue: 'var(--good-text)',
	purple: 'var(--traveller-text)',
	gold: 'var(--heading)',
	green: 'var(--leaf)'
};

/** A run of info-token text with its formatting. */
export interface TextRun {
	text: string;
	bold: boolean;
	italic: boolean;
	/** Underlined (Trevor, 2026-10-16), marked `[u]` … `[/u]`. */
	underline?: boolean;
	color?: InkColor;
}

/** A tag's name: a colour, or `u` for underline. */
type TagName = InkColor | 'u';
type Piece = { text: string } | { stars: number } | { open: TagName } | { close: TagName };

const TAG = new RegExp(`(\\*+|\\[\\/?(?:${[...INK_COLORS, 'u'].join('|')})\\])`);

/**
 * Text, runs of `*` (a run of 4 is two bold markers; 5 or more is plain text), colour tags
 * (`[red]` … `[/red]`) and underline tags (`[u]` … `[/u]`).
 */
function lex(source: string): Piece[] {
	const pieces: Piece[] = [];
	// Splitting on one capture group puts the markers and tags at the odd places.
	source.split(TAG).forEach((part, i) => {
		if (!part) return;
		if (i % 2 === 0) pieces.push({ text: part });
		else if (part.startsWith('[/')) pieces.push({ close: part.slice(2, -1) as TagName });
		else if (part.startsWith('[')) pieces.push({ open: part.slice(1, -1) as TagName });
		else if (part.length > 4) pieces.push({ text: part });
		else if (part.length === 4) pieces.push({ stars: 2 }, { stars: 2 });
		else pieces.push({ stars: part.length });
	});
	return pieces;
}

/**
 * Which tags have a partner: an open tag pairs with the next close of its name. Colour and
 * underline pair separately, so they can overlap.
 */
function pairTags(pieces: readonly Piece[]): Set<number> {
	const paired = new Set<number>();
	const open: { color?: number; u?: number } = {};
	const slot = (name: TagName) => (name === 'u' ? 'u' : 'color');
	pieces.forEach((piece, i) => {
		if ('open' in piece) open[slot(piece.open)] = i;
		else if ('close' in piece) {
			const at = open[slot(piece.close)];
			if (at === undefined || (pieces[at] as { open: TagName }).open !== piece.close) return;
			paired.add(at).add(i);
			open[slot(piece.close)] = undefined;
		}
	});
	return paired;
}

/** One line's runs: markers and tags pair only within the line. */
function parseLine(source: string): TextRun[] {
	const pieces = lex(source);
	const tagsPaired = pairTags(pieces);
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
	let underline = false;
	let color: InkColor | undefined;
	const push = (text: string) => {
		if (!text) return;
		const last = runs.at(-1);
		if (
			last &&
			last.bold === bold &&
			last.italic === italic &&
			!!last.underline === underline &&
			last.color === color
		)
			last.text += text;
		else
			runs.push({
				text,
				bold,
				italic,
				...(underline ? { underline } : {}),
				...(color ? { color } : {})
			});
	};
	pieces.forEach((piece, i) => {
		if ('open' in piece || 'close' in piece) {
			if (!tagsPaired.has(i))
				return push('open' in piece ? `[${piece.open}]` : `[/${piece.close}]`);
			const name = 'open' in piece ? piece.open : piece.close;
			if (name === 'u') underline = 'open' in piece;
			else color = 'open' in piece ? name : undefined;
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

/** A "* " bullet at a line's start belongs to a typed list (`lists.ts`), never to italic. */
const STAR_BULLET = /^[ \t]*\* /;

/** Adds a run, joined to the last one when they look the same. */
function append(runs: TextRun[], run: TextRun) {
	const last = runs.at(-1);
	if (
		last &&
		last.bold === run.bold &&
		last.italic === run.italic &&
		!!last.underline === !!run.underline &&
		last.color === run.color
	)
		last.text += run.text;
	else runs.push({ ...run });
}

/**
 * Splits rich text (info cards, notes) on `**bold**` and `*italic*` markers (`***both***`) and
 * `[red]colour[/red]` tags, which the editor writes (Trevor, 2026-10-16: no typing markers by
 * hand). Rendered as text nodes, never as HTML. A marker or tag without its partner is kept
 * as typed. Each line is read on its own, so a note's "* " bullets and a stray star never
 * reach across lines (Trevor, 2026-10-31: notes and cards share one rich box).
 */
export function parseRich(source: string): TextRun[] {
	const runs: TextRun[] = [];
	source.split('\n').forEach((line, i) => {
		if (i > 0) append(runs, { text: '\n', bold: false, italic: false });
		const bullet = STAR_BULLET.exec(line)?.[0] ?? '';
		if (bullet) append(runs, { text: bullet, bold: false, italic: false });
		for (const run of parseLine(line.slice(bullet.length))) append(runs, run);
	});
	return runs;
}

/** Writes runs back as text with markers, the form custom info tokens are stored in. */
export function toSource(runs: readonly TextRun[]): string {
	const mark = ({ text, bold, italic, underline, color }: TextRun) => {
		if (!text.trim()) return text;
		const stars = (bold ? '**' : '') + (italic ? '*' : '');
		// Markers hug the words; spaces at the edges stay outside them.
		const [, lead, body, trail] = /^(\s*)(.*?)(\s*)$/s.exec(text)!;
		let marked = `${stars}${body}${stars.split('').reverse().join('')}`;
		if (underline) marked = `[u]${marked}[/u]`;
		if (color) marked = `[${color}]${marked}[/${color}]`;
		return `${lead}${marked}${trail}`;
	};
	// Each line is marked on its own, as parseRich reads it.
	return runs
		.map((run) =>
			run.text
				.split('\n')
				.map((text) => mark({ ...run, text }))
				.join('\n')
		)
		.join('');
}

/**
 * Carries an edit made to the plain text (a typed list carried on, renumbered or ended by
 * `lists.ts`) over to the marked source, line by line, so the formatting on other lines stays.
 * A changed line keeps its marks when only its start changed (a list marker); otherwise it
 * becomes the plain line.
 */
export function editLines(source: string, after: string): string {
	const lines = source.split('\n');
	const was = plainText(source).split('\n');
	const now = after.split('\n');
	let head = 0;
	while (head < was.length && head < now.length && was[head] === now[head]) head++;
	let tail = 0;
	while (
		tail < was.length - head &&
		tail < now.length - head &&
		was[was.length - 1 - tail] === now[now.length - 1 - tail]
	)
		tail++;
	const middle = now.slice(head, now.length - tail);
	const changed =
		middle.length === was.length - head - tail
			? middle.map((line, i) => {
					const before = was[head + i];
					let same = 0;
					while (
						same < before.length &&
						same < line.length &&
						before[before.length - 1 - same] === line[line.length - 1 - same]
					)
						same++;
					const removed = before.slice(0, before.length - same);
					const source = lines[head + i];
					return source.startsWith(removed)
						? line.slice(0, line.length - same) + source.slice(removed.length)
						: line;
				})
			: middle;
	return [...lines.slice(0, head), ...changed, ...lines.slice(lines.length - tail)].join('\n');
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
		parseRich(source).map(
			(run) => (run.bold ? { ...run, bold: false, color: run.color ?? 'red' } : run) // colour-ok: an ink name (INK_TOKENS)
		)
	);
}
