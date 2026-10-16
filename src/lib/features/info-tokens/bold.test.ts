import { describe, expect, it } from 'vitest';
import { parseRich, plainText, toSource } from './bold.ts';

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
