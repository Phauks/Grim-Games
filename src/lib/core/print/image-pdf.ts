/**
 * A PDF of pictures, one per page: the printed sheet saved as a file (Trevor, 2026-10-30:
 * "also add download button, so they don't have to change save as pdf"). Each page is a JPEG
 * placed in its margins, which PDF takes as it is (the DCTDecode filter), so no PDF library
 * is needed. Written from the PDF 1.4 file structure: a header, numbered objects, a
 * cross-reference table of their byte offsets, and a trailer (ISO 32000-1, section 7.5).
 */

/**
 * A run of words on the page, in millimetres from the printable area's top left: drawn
 * invisibly over the picture, so the text can be selected, copied and searched (Trevor,
 * 2026-10-30: "a downloaded pdf has selectable text"), the way scanned PDFs are made searchable.
 */
export interface PdfTextRun {
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/** One page: the picture, where it goes on paper, in millimetres, and its words. */
export interface PdfPage {
	jpeg: Uint8Array;
	paperMm: readonly [number, number];
	marginMm: number;
	text?: readonly PdfTextRun[];
}

/** What the file says about itself (a reader's Properties): the script's name, author and so on. */
export interface PdfInfo {
	title?: string;
	author?: string;
	subject?: string;
	creator?: string;
}

/** Text in a PDF string: UTF-16BE behind a byte-order mark, as hex, so any script name fits. */
export function pdfText(text: string): string {
	let hex = 'FEFF';
	for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, '0');
	return `<${hex.toUpperCase()}>`;
}

/** A JPEG's size in pixels and colour channels, from its frame header (SOFn). */
export function jpegSize(jpeg: Uint8Array): { width: number; height: number; channels: number } {
	if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('not a JPEG');
	let at = 2;
	while (at + 9 < jpeg.length) {
		if (jpeg[at] !== 0xff) throw new Error('bad JPEG marker');
		const marker = jpeg[at + 1];
		// Padding before a marker.
		if (marker === 0xff) {
			at++;
			continue;
		}
		const length = (jpeg[at + 2] << 8) | jpeg[at + 3];
		// Frame headers are C0 to CF, less C4 (Huffman tables), C8 (reserved) and CC (arithmetic).
		if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
			return {
				height: (jpeg[at + 5] << 8) | jpeg[at + 6],
				width: (jpeg[at + 7] << 8) | jpeg[at + 8],
				channels: jpeg[at + 9]
			};
		at += 2 + length;
	}
	throw new Error('JPEG has no frame header');
}

/** Windows-1252 bytes for the characters outside Latin-1 that sheets use (curly quotes, dashes). */
const WIN_ANSI: Readonly<Record<string, number>> = {
	'€': 0x80,
	'‚': 0x82,
	ƒ: 0x83,
	'„': 0x84,
	'…': 0x85,
	'†': 0x86,
	'‡': 0x87,
	ˆ: 0x88,
	'‰': 0x89,
	Š: 0x8a,
	'‹': 0x8b,
	Œ: 0x8c,
	Ž: 0x8e,
	'‘': 0x91,
	'’': 0x92,
	'“': 0x93,
	'”': 0x94,
	'•': 0x95,
	'–': 0x96,
	'—': 0x97,
	'˜': 0x98,
	'™': 0x99,
	š: 0x9a,
	'›': 0x9b,
	œ: 0x9c,
	ž: 0x9e,
	Ÿ: 0x9f
};

/**
 * Text as a PDF literal string in WinAnsiEncoding (ISO 32000-1, Annex D), one byte a
 * character. A character it has no byte for becomes "?", since the layer only serves copying.
 */
export function winAnsiString(text: string): Uint8Array {
	const bytes: number[] = [0x28];
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0x3f;
		// A no-break space copies as a plain one.
		const byte =
			char === '\u00a0'
				? 0x20
				: (WIN_ANSI[char] ??
					(code >= 0x20 && code <= 0xff && !(code >= 0x7f && code < 0xa0) ? code : 0x3f));
		if (byte === 0x28 || byte === 0x29 || byte === 0x5c) bytes.push(0x5c);
		bytes.push(byte);
	}
	bytes.push(0x29);
	return new Uint8Array(bytes);
}

/** Courier's every character is 600/1000 of the type size wide, so a run's stretch is simple. */
const COURIER_WIDTH = 0.6;

const POINTS_PER_MM = 72 / 25.4;
const pt = (mm: number) => Number((mm * POINTS_PER_MM).toFixed(2));

/** The PDF file: each page's paper, with its picture filling the paper less its margins. */
export function imagePdf(pages: readonly PdfPage[], info: PdfInfo = {}): Uint8Array {
	const encoder = new TextEncoder();
	const parts: Uint8Array[] = [];
	const offsets: number[] = [];
	let length = 0;
	const write = (part: string | Uint8Array) => {
		const bytes = typeof part === 'string' ? encoder.encode(part) : part;
		parts.push(bytes);
		length += bytes.length;
	};
	const object = (id: number, body: string, stream?: Uint8Array) => {
		offsets[id] = length;
		write(`${id} 0 obj\n${body}\n`);
		if (stream) {
			write('stream\n');
			write(stream);
			write('\nendstream\n');
		}
		write('endobj\n');
	};

	// Binary bytes in the comment tell tools the file holds binary data.
	write('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
	// 1: the catalog; 2: the page tree; 3: the font of the hidden text; then a page, its
	// picture and its drawing per page.
	const pageId = (i: number) => 4 + i * 3;
	object(1, '<< /Type /Catalog /Pages 2 0 R >>');
	const kids = pages.map((_, i) => `${pageId(i)} 0 R`).join(' ');
	object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
	object(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
	pages.forEach((page, i) => {
		const id = pageId(i);
		const [width, height] = page.paperMm.map(pt);
		const margin = pt(page.marginMm);
		const image = jpegSize(page.jpeg);
		const colour = image.channels === 1 ? '/DeviceGray' : '/DeviceRGB';
		const draw = concat([
			encoder.encode(
				`q ${pt(page.paperMm[0] - 2 * page.marginMm)} 0 0 ${pt(page.paperMm[1] - 2 * page.marginMm)} ${margin} ${margin} cm /Im0 Do Q\n`
			),
			hiddenText(page)
		]);
		object(
			id,
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
				`/Resources << /XObject << /Im0 ${id + 1} 0 R >> /Font << /F1 3 0 R >> >> /Contents ${id + 2} 0 R >>`
		);
		object(
			id + 1,
			`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
				`/ColorSpace ${colour} /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>`,
			page.jpeg
		);
		object(id + 2, `<< /Length ${draw.length} >>`, draw);
	});

	// Last, the document information dictionary (ISO 32000-1, section 14.3.3).
	const infoId = pageId(pages.length);
	const fields = (
		[
			['Title', info.title],
			['Author', info.author],
			['Subject', info.subject],
			['Creator', info.creator]
		] as const
	).filter(([, value]) => value);
	object(
		infoId,
		`<< ${fields.map(([key, value]) => `/${key} ${pdfText(value ?? '')}`).join(' ')} >>`
	);

	const size = infoId + 1;
	const xref = length;
	// Each entry is exactly 20 bytes: offset, generation, in use, and a two-byte line end.
	const entries = ['0000000000 65535 f \n'];
	for (let id = 1; id < size; id++)
		entries.push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
	write(`xref\n0 ${size}\n${entries.join('')}`);
	write(
		`trailer\n<< /Size ${size} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
	);

	return concat(parts);
}

/**
 * The page's words, invisible (text render mode 3), each run stretched over the words it
 * covers in the picture so a selection lines up with them (ISO 32000-1, section 9.3).
 */
function hiddenText(page: PdfPage): Uint8Array {
	const runs = page.text ?? [];
	if (runs.length === 0) return new Uint8Array();
	const encoder = new TextEncoder();
	const top = page.paperMm[1] - page.marginMm;
	const parts: Uint8Array[] = [encoder.encode('BT 3 Tr\n')];
	for (const run of runs) {
		const characters = [...run.text].length;
		if (characters === 0 || run.width <= 0 || run.height <= 0) continue;
		// The type a little smaller than its line, sitting on the line's descender.
		const size = pt(run.height * 0.8);
		const stretch = (pt(run.width) / (characters * COURIER_WIDTH * size)) * 100;
		const baseline = pt(top - run.y - run.height * 0.8);
		parts.push(
			encoder.encode(
				`/F1 ${size} Tf ${stretch.toFixed(2)} Tz 1 0 0 1 ${pt(page.marginMm + run.x)} ${baseline} Tm `
			),
			winAnsiString(run.text),
			encoder.encode(' Tj\n')
		);
	}
	parts.push(encoder.encode('ET\n'));
	return concat(parts);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
	const file = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let at = 0;
	for (const part of parts) {
		file.set(part, at);
		at += part.length;
	}
	return file;
}
