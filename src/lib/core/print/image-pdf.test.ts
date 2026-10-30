import { describe, expect, it } from 'vitest';
import { imagePdf, jpegSize, pdfText } from './image-pdf.ts';

/** The smallest JPEG shape the reader looks at: start, an APP0 segment, then a frame header. */
function jpeg(width: number, height: number, channels = 3): Uint8Array {
	return new Uint8Array([
		0xff,
		0xd8,
		// APP0, 4 bytes long (its length counts itself).
		0xff,
		0xe0,
		0x00,
		0x04,
		0x00,
		0x00,
		// SOF0: length, precision, height, width, channels.
		0xff,
		0xc0,
		0x00,
		0x0b,
		0x08,
		height >> 8,
		height & 0xff,
		width >> 8,
		width & 0xff,
		channels,
		0x01,
		0x11,
		0x00,
		0xff,
		0xd9
	]);
}

const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

describe('jpegSize', () => {
	it('reads the frame header past other segments', () => {
		expect(jpegSize(jpeg(2448, 3168))).toEqual({ width: 2448, height: 3168, channels: 3 });
	});

	it('refuses what is not a JPEG', () => {
		expect(() => jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow('not a JPEG');
	});
});

describe('imagePdf', () => {
	const pages = [
		{ jpeg: jpeg(100, 130), paperMm: [215.9, 279.4] as const, marginMm: 10 },
		{ jpeg: jpeg(100, 140, 1), paperMm: [215.9, 279.4] as const, marginMm: 10 }
	];
	const file = imagePdf(pages, { title: 'Trouble Brewing', author: 'The Pandemonium Institute' });
	const pdf = text(file);

	it('is a PDF with one page per picture', () => {
		expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
		expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
		expect(pdf).toContain('/Count 2');
		expect(pdf.match(/\/Type \/Page /g)).toHaveLength(2);
	});

	it('sizes each page to its paper in points, the picture inside the margins', () => {
		// Letter is 612 by 792 points; a 10 mm margin is 28.35 points.
		expect(pdf).toContain('/MediaBox [0 0 612 792]');
		expect(pdf).toContain('q 555.31 0 0 735.31 28.35 28.35 cm /Im0 Do Q');
	});

	it('embeds each JPEG as it is, with its size and colours', () => {
		expect(pdf).toContain('/Width 100 /Height 130 /ColorSpace /DeviceRGB');
		expect(pdf).toContain('/Width 100 /Height 140 /ColorSpace /DeviceGray');
		expect(pdf).toContain('/Filter /DCTDecode');
	});

	it('points its cross-reference table at each object', () => {
		const xref = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
		expect(pdf.slice(xref, xref + 4)).toBe('xref');
		const entries = [...pdf.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
		expect(entries).toHaveLength(9);
		entries.forEach((offset, i) =>
			expect(pdf.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true)
		);
	});
});

describe('the file information', () => {
	it('names the script and its author', () => {
		const pdf = text(
			imagePdf([{ jpeg: jpeg(1, 1), paperMm: [210, 297], marginMm: 0 }], {
				title: 'Bad Moon',
				author: 'TPI'
			})
		);
		expect(pdf).toContain(`/Title ${pdfText('Bad Moon')} /Author ${pdfText('TPI')}`);
		expect(pdf).toMatch(/\/Root 1 0 R \/Info 6 0 R/);
	});

	it('writes any name as UTF-16 behind a byte-order mark', () => {
		expect(pdfText('Aé')).toBe('<FEFF004100E9>');
	});
});
