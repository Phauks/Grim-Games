import { describe, expect, it } from 'vitest';
import { boldToRed, editLines, parseRich, plainText, toSource } from './rich.ts';

const plain = (text: string) => ({ text, bold: false, italic: false });
const bold = (text: string) => ({ text, bold: true, italic: false });
const italic = (text: string) => ({ text, bold: false, italic: true });

describe('parseRich', () => {
	it('splits **bold** runs out of plain text', () => {
		expect(parseRich('You are **mad** about **Chef**')).toEqual([
			plain('You are '),
			bold('mad'),
			plain(' about '),
			bold('Chef')
		]);
	});

	it('reads *italic* and ***bold italic***', () => {
		expect(parseRich('You *are* ***mad***')).toEqual([
			plain('You '),
			italic('are'),
			plain(' '),
			{ text: 'mad', bold: true, italic: true }
		]);
	});

	it('keeps a marker without its partner as typed', () => {
		expect(parseRich('2 ** 3')).toEqual([plain('2 ** 3')]);
		expect(parseRich('Each night*, choose')).toEqual([plain('Each night*, choose')]);
	});

	it('drops empty runs and handles text that is all bold', () => {
		expect(parseRich('****')).toEqual([]);
		expect(parseRich('**Evil**')).toEqual([bold('Evil')]);
	});

	it('never produces markup', () => {
		expect(parseRich('<b>x</b>')).toEqual([plain('<b>x</b>')]);
		expect(plainText('**<i>**')).toBe('<i>');
	});
});

describe('toSource', () => {
	it('writes runs back so they read the same', () => {
		const runs = [plain('You are '), bold('mad'), plain(' and '), italic('sad'), plain('!')];
		expect(toSource(runs)).toBe('You are **mad** and *sad*!');
		expect(parseRich(toSource(runs))).toEqual(runs);
	});

	it('keeps spaces outside the markers', () => {
		expect(toSource([plain('a'), bold(' b '), plain('c')])).toBe('a **b** c');
	});
});

describe('colour', () => {
	it('reads [red] tags as coloured runs, separate from bold', () => {
		expect(parseRich('You are [red]mad[/red] and **[blue]sad[/blue]**')).toEqual([
			plain('You are '),
			{ ...plain('mad'), color: 'red' },
			plain(' and '),
			{ ...bold('sad'), color: 'blue' }
		]);
	});

	it('keeps unknown or unpartnered tags as typed', () => {
		expect(parseRich('[pink]x[/pink] [red]y')).toEqual([plain('[pink]x[/pink] [red]y')]);
		expect(parseRich('[red]x[/blue]')).toEqual([plain('[red]x[/blue]')]);
	});

	it('writes colour back so it reads the same', () => {
		const runs = [plain('a '), { ...bold('b'), color: 'gold' as const }, plain(' c')];
		expect(toSource(runs)).toBe('a [gold]**b**[/gold] c');
		expect(parseRich(toSource(runs))).toEqual(runs);
	});

	it('turns old bold, which was drawn red, into red text', () => {
		expect(boldToRed('You are **mad** and ***sad***')).toBe(
			'You are [red]mad[/red] and [red]*sad*[/red]'
		);
	});
});

describe('underline', () => {
	it('reads [u] tags, alongside colour and bold', () => {
		expect(parseRich('a [u]b [red]**c**[/red][/u]')).toEqual([
			plain('a '),
			{ ...plain('b '), underline: true },
			{ ...bold('c'), underline: true, color: 'red' }
		]);
	});

	it('writes underline back so it reads the same', () => {
		const runs = [plain('a '), { ...italic('b'), underline: true, color: 'blue' as const }];
		expect(toSource(runs)).toBe('a [blue][u]*b*[/u][/blue]');
		expect(parseRich(toSource(runs))).toEqual(runs);
	});

	it('keeps an unpartnered [u] as typed', () => {
		expect(parseRich('[u]x')).toEqual([plain('[u]x')]);
	});
});

// Notes and cards share one rich box with typed lists (Trevor, 2026-10-31).
describe('several lines', () => {
	it('pairs markers only within a line', () => {
		expect(parseRich('a *b\nc* d')).toEqual([plain('a *b\nc* d')]);
		expect(parseRich('**a**\n*b*')).toEqual([bold('a'), plain('\n'), italic('b')]);
	});

	it('reads a "* " bullet at a line start as the list, not italic', () => {
		expect(parseRich('* one\n* two')).toEqual([plain('* one\n* two')]);
		expect(parseRich('* **one**')).toEqual([plain('* '), bold('one')]);
	});

	it('marks each line of a run that crosses lines', () => {
		const source = toSource([bold('one\ntwo')]);
		expect(source).toBe('**one**\n**two**');
		expect(parseRich(source)).toEqual([bold('one'), plain('\n'), bold('two')]);
	});
});

describe('editLines', () => {
	it('adds a list marker without losing the formatting on the line', () => {
		expect(editLines('1. **a**\n**b**', '1. a\n2. b')).toBe('1. **a**\n2. **b**');
	});

	it('renumbers later items and keeps their marks', () => {
		expect(editLines('1. a\n**x**\n2. *b*', '1. a\n2. x\n3. b')).toBe('1. a\n2. **x**\n3. *b*');
	});

	it('ends a list by taking an empty item away', () => {
		expect(editLines('- **a**\n- \n', '- a\n')).toBe('- **a**\n');
	});
});
