import { describe, expect, it } from 'vitest';
import { afterLineBreak, type TextEdit } from './lists.ts';

/** Text with the caret (`|`) or a selection (`[`…`]`) marked in it. */
function parse(marked: string): { text: string; start: number; end: number } {
	if (marked.includes('|')) {
		const at = marked.indexOf('|');
		return { text: marked.replace('|', ''), start: at, end: at };
	}
	const start = marked.indexOf('[');
	const end = marked.indexOf(']') - 1;
	return { text: marked.replace('[', '').replace(']', ''), start, end };
}

function show(edit: TextEdit | undefined): string | undefined {
	if (!edit) return undefined;
	const { text, start, end } = edit;
	return start === end
		? text.slice(0, start) + '|' + text.slice(start)
		: text.slice(0, start) + '[' + text.slice(start, end) + ']' + text.slice(end);
}

const lineBreak = (marked: string) => {
	const { text, start } = parse(marked);
	return show(afterLineBreak(text, start));
};

describe('afterLineBreak', () => {
	it('continues a bullet list with the same bullet', () => {
		expect(lineBreak('• Ana claimed Chef\n|')).toBe('• Ana claimed Chef\n• |');
		expect(lineBreak('- typed dash\n|')).toBe('- typed dash\n- |');
		expect(lineBreak('* star\n|')).toBe('* star\n* |');
		expect(lineBreak('+ plus\n|')).toBe('+ plus\n+ |');
	});

	it('continues a list counted in brackets or by letter', () => {
		expect(lineBreak('(1) one\n|')).toBe('(1) one\n(2) |');
		expect(lineBreak('a. Ana\n|')).toBe('a. Ana\nb. |');
		expect(lineBreak('a) Ana\n|\nb) Ben')).toBe('a) Ana\nb) |\nc) Ben');
		expect(lineBreak('(C) Cal\n|')).toBe('(C) Cal\n(D) |');
		// Nothing comes after z.
		expect(lineBreak('z. last\n|')).toBeUndefined();
	});

	it('renumbers only the items of the same list', () => {
		expect(lineBreak('1. one\n|\n2) other')).toBe('1. one\n2. |\n2) other');
	});

	it('continues a numbered list with the next number, renumbering the rest', () => {
		expect(lineBreak('1. one\n|')).toBe('1. one\n2. |');
		expect(lineBreak('1. one\n|\n2. two')).toBe('1. one\n2. |\n3. two');
		expect(lineBreak('3) three\n|')).toBe('3) three\n4) |');
	});

	it('keeps the indent of a nested item', () => {
		expect(lineBreak('  • inner\n|')).toBe('  • inner\n  • |');
	});

	it('moves the words after the caret onto the new item', () => {
		expect(lineBreak('• Ana\n|Ben')).toBe('• Ana\n• |Ben');
	});

	it('ends the list when the item above was left empty', () => {
		expect(lineBreak('• Ana\n• \n|')).toBe('• Ana\n|');
		expect(lineBreak('1. one\n2. \n|\nafter')).toBe('1. one\n|\nafter');
	});

	it('leaves plain lines and breaks inside a marker alone', () => {
		expect(lineBreak('plain\n|')).toBeUndefined();
		expect(lineBreak('-not a bullet\n|')).toBeUndefined();
		expect(lineBreak('2024. was a year\n|')).toBeUndefined();
		expect(lineBreak('(1. unclosed\n|')).toBeUndefined();
		expect(lineBreak('ab. two letters\n|')).toBeUndefined();
		expect(lineBreak('no break|')).toBeUndefined();
	});
});
