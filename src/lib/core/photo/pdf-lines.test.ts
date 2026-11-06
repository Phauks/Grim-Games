import { describe, expect, it } from 'vitest';
import { pdfLines, type PdfText } from './pdf-lines.ts';

const run = (text: string, x: number, y: number, height = 10): PdfText => ({
	text,
	x,
	y,
	width: text.length * height * 0.5,
	height
});

describe('pdfLines', () => {
	it('joins runs on one row and orders rows top to bottom', () => {
		const lines = pdfLines([
			run('Chef', 20, 600),
			run('Trouble Brewing', 100, 760, 30),
			run('You start knowing', 50, 601),
			run('Empath', 20, 580)
		]);
		expect(lines).toEqual([
			{ text: 'Trouble Brewing', height: 30 },
			{ text: 'Chef You start knowing', height: 10 },
			{ text: 'Empath', height: 10 }
		]);
	});

	it('splits a row at a wide gap, so two columns give two lines', () => {
		const lines = pdfLines([run('Chef', 20, 600), run('Imp', 400, 600)]);
		expect(lines.map((l) => l.text)).toEqual(['Chef', 'Imp']);
	});

	it('skips blank runs', () => {
		expect(pdfLines([run(' ', 20, 600), run('Monk', 20, 580)])).toEqual([
			{ text: 'Monk', height: 10 }
		]);
	});
});
