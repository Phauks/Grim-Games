/**
 * Bulleted and numbered lists in plain note text (Trevor, 2026-10-30). A list is only the
 * text itself: a line that starts with "• " (or a typed "- " or "* ") is a bullet, one that
 * starts with "1. " (or "1) ") is numbered, so a note stays one string, needs no saved-game
 * migration and reads the same in its card's preview, a shared copy and the editor.
 */

export type ListKind = 'bullet' | 'numbered';

/** The text after an edit, and the selection to put back. */
export interface TextEdit {
	text: string;
	start: number;
	end: number;
}

/** The bullet the list buttons write. */
export const BULLET = '•';

interface Item {
	indent: string;
	kind: ListKind;
	/** The bullet character, or the number's "." or ")". */
	mark: string;
	number: number;
	/** Indent and marker with its space: where the item's words start. */
	length: number;
}

const ITEM = /^([ \t]*)(?:([•*-])|(\d{1,3})([.)])) /;

function itemOf(line: string): Item | undefined {
	const match = ITEM.exec(line);
	if (!match) return undefined;
	const [whole, indent, bullet, digits, delimiter] = match;
	return bullet
		? { indent, kind: 'bullet', mark: bullet, number: 0, length: whole.length }
		: { indent, kind: 'numbered', mark: delimiter, number: Number(digits), length: whole.length };
}

function marker(item: Pick<Item, 'indent' | 'kind' | 'mark' | 'number'>): string {
	return item.kind === 'bullet'
		? `${item.indent}${item.mark} `
		: `${item.indent}${item.number}${item.mark} `;
}

function lineStart(text: string, pos: number): number {
	return text.lastIndexOf('\n', pos - 1) + 1;
}

function lineEnd(text: string, pos: number): number {
	const end = text.indexOf('\n', pos);
	return end === -1 ? text.length : end;
}

/** The kind of list the line at `pos` is in, if any. */
export function listAt(text: string, pos: number): ListKind | undefined {
	const start = lineStart(text, pos);
	return itemOf(text.slice(start, lineEnd(text, start)))?.kind;
}

/**
 * Numbers the numbered items after line `from` on from it, while they stay in its list (the
 * same indent), so an item added or removed in the middle keeps 1, 2, 3.
 */
function renumberAfter(lines: string[], from: number) {
	const first = itemOf(lines[from] ?? '');
	if (first?.kind !== 'numbered') return;
	let number = first.number;
	for (let i = from + 1; i < lines.length; i++) {
		const item = itemOf(lines[i]);
		if (item?.kind !== 'numbered' || item.indent !== first.indent) return;
		number += 1;
		lines[i] = marker({ ...item, number }) + lines[i].slice(item.length);
	}
}

/**
 * After a new line is typed at `caret`: continues the list the line above was in with the next
 * bullet or number, or, when that item was left empty, ends the list by taking its marker away
 * (as word processors do). Undefined when the line above isn't a list item.
 */
export function afterLineBreak(text: string, caret: number): TextEdit | undefined {
	if (caret < 1 || text[caret - 1] !== '\n') return undefined;
	const aboveStart = lineStart(text, caret - 1);
	const above = text.slice(aboveStart, caret - 1);
	const item = itemOf(above);
	// A break typed inside the marker itself is an ordinary new line.
	if (!item || above.length < item.length) return undefined;
	const lines = text.split('\n');
	const row = text.slice(0, caret).split('\n').length - 1;
	if (!above.slice(item.length).trim() && !text.slice(caret, lineEnd(text, caret)).trim()) {
		// An empty item: the list ends here, on a plain line.
		lines.splice(row - 1, 2, item.indent);
		const at = aboveStart + item.indent.length;
		return { text: lines.join('\n'), start: at, end: at };
	}
	const next = marker({ ...item, number: item.number + 1 });
	lines[row] = next + lines[row];
	renumberAfter(lines, row);
	const at = caret + next.length;
	return { text: lines.join('\n'), start: at, end: at };
}

/**
 * The list buttons: makes the lines the selection touches a list of this kind, or plain
 * lines again when they all already are one. A numbered list carries on from a numbered
 * line just above it. A caret stays on its words; a selection grows to the whole lines.
 */
export function toggleList(text: string, start: number, end: number, kind: ListKind): TextEdit {
	const from = lineStart(text, start);
	// A selection that ends at the start of a line doesn't take that line in.
	const to = lineEnd(text, end > start && text[end - 1] === '\n' ? end - 1 : end);
	const lines = text.split('\n');
	const first = text.slice(0, from).split('\n').length - 1;
	const count = text.slice(from, to).split('\n').length;
	const touched = lines.slice(first, first + count);
	// Blank lines in a selection of several stay blank.
	const listed = touched.map((line) => count === 1 || line.trim() !== '');
	const undo = touched.every((line, i) => !listed[i] || itemOf(line)?.kind === kind);

	const previous = first > 0 ? itemOf(lines[first - 1]) : undefined;
	let number = previous?.kind === 'numbered' ? previous.number : 0;
	let caretShift = 0;
	touched.forEach((line, i) => {
		if (!listed[i]) return;
		const item = itemOf(line);
		const indent = item?.indent ?? /^[ \t]*/.exec(line)![0];
		const words = line.slice(item?.length ?? indent.length);
		const prefix = undo
			? indent
			: marker({ indent, kind, mark: kind === 'bullet' ? BULLET : '.', number: ++number });
		lines[first + i] = prefix + words;
		if (i === 0) caretShift = prefix.length - (item?.length ?? indent.length);
	});
	renumberAfter(lines, first + count - 1);

	const next = lines.join('\n');
	if (start === end) {
		const at = Math.max(from + wordsOffset(lines[first]), start + caretShift);
		return { text: next, start: at, end: at };
	}
	const last = first + count - 1;
	const stop = lines.slice(0, last + 1).join('\n').length;
	return { text: next, start: from, end: stop };
}

/** How far into a line its words start: past its marker, or its indent. */
function wordsOffset(line: string): number {
	return itemOf(line)?.length ?? /^[ \t]*/.exec(line)![0].length;
}
