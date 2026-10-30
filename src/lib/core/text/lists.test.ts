import { describe, expect, it } from 'vitest';
import { afterLineBreak, listAt, toggleList, type TextEdit } from './lists.ts';

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
const toggle = (marked: string, kind: 'bullet' | 'numbered') => {
	const { text, start, end } = parse(marked);
	return show(toggleList(text, start, end, kind));
};

describe('afterLineBreak', () => {
	it('continues a bullet list with the same bullet', () => {
		expect(lineBreak('• Ana claimed Chef\n|')).toBe('• Ana claimed Chef\n• |');
		expect(lineBreak('- typed dash\n|')).toBe('- typed dash\n- |');
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
		expect(lineBreak('no break|')).toBeUndefined();
	});
});

describe('toggleList', () => {
	it('makes the caret line a bullet, keeping the caret on its words', () => {
		expect(toggle('Ana is |Chef', 'bullet')).toBe('• Ana is |Chef');
		expect(toggle('first\nsec|ond', 'bullet')).toBe('first\n• sec|ond');
	});

	it('starts a list on an empty line', () => {
		expect(toggle('|', 'bullet')).toBe('• |');
		expect(toggle('|', 'numbered')).toBe('1. |');
	});

	it('takes the bullet off a line that already has one', () => {
		expect(toggle('• Ana |Chef', 'bullet')).toBe('Ana |Chef');
		expect(toggle('•| Ana', 'bullet')).toBe('|Ana');
	});

	it('switches a bullet to a number and back', () => {
		expect(toggle('• Ana|', 'numbered')).toBe('1. Ana|');
		expect(toggle('1. Ana|', 'bullet')).toBe('• Ana|');
	});

	it('numbers every line of a selection, skipping blank ones', () => {
		expect(toggle('[Ana\n\nBen\nCal]', 'numbered')).toBe('[1. Ana\n\n2. Ben\n3. Cal]');
	});

	it('takes a selection out of a list when every line is already in one', () => {
		expect(toggle('[• Ana\n• Ben]', 'bullet')).toBe('[Ana\nBen]');
	});

	it('carries a numbered list on from the line above and renumbers below', () => {
		expect(toggle('1. one\ntw|o\n2. three', 'numbered')).toBe('1. one\n2. tw|o\n3. three');
	});

	it('leaves the line after a selection ending at its start alone', () => {
		expect(toggle('[Ana\n]Ben', 'bullet')).toBe('[• Ana]\nBen');
	});
});

describe('listAt', () => {
	it('names the list the caret line is in', () => {
		expect(listAt('plain\n• Ana', 8)).toBe('bullet');
		expect(listAt('1. one\nplain', 2)).toBe('numbered');
		expect(listAt('1. one\nplain', 9)).toBeUndefined();
	});
});
