/**
 * Bulleted and numbered lists in plain note text (Trevor, 2026-10-30: no buttons, a list
 * starts when people type one). A line that starts with a bullet ("- ", "* ", "+ ", "• ") or
 * a counter ("1. ", "1) ", "(1) ", "a. ", "a) ", "(a) ", "A. ") is a list item, and Enter
 * carries the list on. The list is only the text itself, so a note stays one string, needs no
 * saved-game migration and reads the same in its card's preview, a shared copy and the editor.
 */

/** The text after an edit, and the selection to put back. */
export interface TextEdit {
	text: string;
	start: number;
	end: number;
}

interface Item {
	indent: string;
	/** A bullet character, or "" for a counter. */
	bullet: string;
	/** "(" before a counter, or "". */
	open: string;
	/** The counter: a number, or one letter. */
	counter: number | string;
	/** "." or ")" after a counter. */
	close: string;
	/** Indent and marker with its space: where the item's words start. */
	length: number;
}

/**
 * A counter is up to three digits ("2024. was a year" isn't a list) or one letter, followed
 * by "." or ")", or in brackets.
 */
const ITEM = /^([ \t]*)(?:([-*+•])|\((\d{1,3}|[a-zA-Z])\)|(\d{1,3}|[a-zA-Z])([.)])) /;

function itemOf(line: string): Item | undefined {
	const match = ITEM.exec(line);
	if (!match) return undefined;
	const [whole, indent, bullet = '', bracketed, plain, close] = match;
	const raw = bracketed ?? plain ?? '';
	return {
		indent,
		bullet,
		open: bracketed ? '(' : '',
		counter: /\d/.test(raw) ? Number(raw) : raw,
		close: bracketed ? ')' : (close ?? ''),
		length: whole.length
	};
}

/** The next counter: 2 after 1, b after a; none after z. */
function next(counter: number | string): number | string | undefined {
	if (typeof counter === 'number') return counter + 1;
	return /[zZ]/.test(counter) ? undefined : String.fromCharCode(counter.charCodeAt(0) + 1);
}

function marker(item: Omit<Item, 'length'>): string {
	return item.bullet
		? `${item.indent}${item.bullet} `
		: `${item.indent}${item.open}${item.counter}${item.close} `;
}

/** Items of one list: the same indent and the same bullet or counter style. */
function sameList(a: Item, b: Item): boolean {
	return (
		a.indent === b.indent &&
		a.bullet === b.bullet &&
		a.open === b.open &&
		a.close === b.close &&
		typeof a.counter === typeof b.counter
	);
}

function lineStart(text: string, pos: number): number {
	return text.lastIndexOf('\n', pos - 1) + 1;
}

function lineEnd(text: string, pos: number): number {
	const end = text.indexOf('\n', pos);
	return end === -1 ? text.length : end;
}

/**
 * Counts on the items after line `from` from it, while they stay in its list, so an item added
 * in the middle keeps 1, 2, 3.
 */
function renumberAfter(lines: string[], from: number) {
	const first = itemOf(lines[from] ?? '');
	if (!first || first.bullet) return;
	let counter: number | string | undefined = first.counter;
	for (let i = from + 1; i < lines.length; i++) {
		const item = itemOf(lines[i]);
		counter = counter === undefined ? undefined : next(counter);
		if (!item || !sameList(first, item) || counter === undefined) return;
		lines[i] = marker({ ...item, counter }) + lines[i].slice(item.length);
	}
}

/**
 * After a new line is typed at `caret`: continues the list the line above was in with the same
 * bullet or the next number or letter, or, when that item was left empty, ends the list by
 * taking its marker away (as word processors do). Undefined when the line above isn't a list
 * item.
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
	const counter = item.bullet ? item.counter : next(item.counter);
	if (counter === undefined) return undefined;
	const start = marker({ ...item, counter });
	lines[row] = start + lines[row];
	renumberAfter(lines, row);
	const at = caret + start.length;
	return { text: lines.join('\n'), start: at, end: at };
}
