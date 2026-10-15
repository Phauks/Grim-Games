import { describe, expect, it } from 'vitest';
import { parseBold, plainText } from './bold.ts';

describe('parseBold', () => {
	it('splits **bold** runs out of plain text', () => {
		expect(parseBold('You are **mad** about **Chef**')).toEqual([
			{ text: 'You are ', bold: false },
			{ text: 'mad', bold: true },
			{ text: ' about ', bold: false },
			{ text: 'Chef', bold: true }
		]);
	});

	it('keeps an unclosed marker as typed', () => {
		expect(parseBold('2 ** 3')).toEqual([{ text: '2 ** 3', bold: false }]);
	});

	it('drops empty runs and handles text that is all bold', () => {
		expect(parseBold('****')).toEqual([]);
		expect(parseBold('**Evil**')).toEqual([{ text: 'Evil', bold: true }]);
	});

	it('never produces markup', () => {
		expect(parseBold('<b>x</b>')).toEqual([{ text: '<b>x</b>', bold: false }]);
		expect(plainText('**<i>**')).toBe('<i>');
	});
});
