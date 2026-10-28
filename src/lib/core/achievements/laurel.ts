/**
 * The laurel generator: draws a laurel's form in a chosen colour as frame shapes, so a laurel
 * draws wherever a frame does (seat tokens, the player's grim, the profile). Our own drawing,
 * never Clocktower art (research/frames.md). Mockups: https://claude.ai/artifact/JeH7Y1JY7x24vV2Cw9XNYW
 *
 * Leaves big enough to read need a wider band than other frames, so the face shrinks to
 * `LAUREL_FACE_RADIUS`, still inside the token's own footprint. Each leaf has a dark outline,
 * a base, a lighter half and a midrib: the outline keeps leaves apart at a phone's seat size,
 * where gradients and lighting filters blur into one band (comparison, Trevor 2026-10-27:
 * https://claude.ai/artifact/8ZdRr76tRR7HW6A594jYCJ). Each layer of a branch is one path, so
 * a laurel is ten shapes however many leaves it has, which keeps a full town light to draw.
 *
 * Only the branch forms are drawn so far; the ring forms (flames, chain, star halo), the
 * medallion, crest, accent and motion come with the achievements feature.
 */
import type { FrameShape } from '#lib/core/frames/index.ts';

/** The face's radius, in the 100 by 100 box, inside a laurel (frames use `FACE_RADIUS`). */
export const LAUREL_FACE_RADIUS = 36;

export const LAUREL_FORMS = ['laurel', 'olive', 'myrtle', 'ivy', 'feather', 'briar'] as const;
export type LaurelForm = (typeof LAUREL_FORMS)[number];

export const LAUREL_FORM_NAMES: Record<LaurelForm, string> = {
	laurel: 'Laurel',
	olive: 'Olive',
	myrtle: 'Myrtle',
	ivy: 'Ivy',
	feather: 'Feathers',
	briar: 'Briar'
};

/** A colour's base, its lighter half, its dark midrib, and the outline round each leaf. */
export type Material = readonly [base: string, light: string, dark: string, ink: string];

// Laurels are pictures, so their colours are their own, like the frames' and the backgrounds'.
export const LAUREL_COLOURS = {
	// The theme's own accent, mixed lighter and darker, so a frame can follow the theme.
	accent: [
		'var(--accent)',
		'color-mix(in oklch, var(--accent) 60%, white)',
		'color-mix(in oklch, var(--accent) 65%, black)',
		'color-mix(in oklch, var(--accent) 35%, black)'
	],
	bronze: [
		'oklch(0.62 0.1 55)',
		'oklch(0.74 0.09 60)',
		'oklch(0.42 0.08 50)',
		'oklch(0.28 0.05 50)'
	],
	silver: [
		'oklch(0.78 0.01 250)',
		'oklch(0.9 0.01 250)',
		'oklch(0.55 0.015 250)',
		'oklch(0.3 0.01 250)'
	],
	gold: ['oklch(0.78 0.13 85)', 'oklch(0.89 0.1 90)', 'oklch(0.56 0.11 75)', 'oklch(0.3 0.06 70)'],
	green: [
		'oklch(0.6 0.12 145)',
		'oklch(0.74 0.12 140)',
		'oklch(0.4 0.08 150)',
		'oklch(0.25 0.05 150)'
	],
	townsfolk: [
		'oklch(0.6 0.13 245)',
		'oklch(0.74 0.11 240)',
		'oklch(0.42 0.1 250)',
		'oklch(0.25 0.06 250)'
	],
	outsider: [
		'oklch(0.7 0.1 210)',
		'oklch(0.82 0.08 205)',
		'oklch(0.5 0.08 215)',
		'oklch(0.28 0.05 215)'
	],
	minion: [
		'oklch(0.62 0.17 35)',
		'oklch(0.74 0.14 45)',
		'oklch(0.44 0.13 30)',
		'oklch(0.27 0.08 30)'
	],
	demon: [
		'oklch(0.52 0.19 25)',
		'oklch(0.64 0.18 28)',
		'oklch(0.36 0.13 22)',
		'oklch(0.22 0.07 22)'
	],
	traveller: [
		'oklch(0.6 0.13 310)',
		'oklch(0.74 0.11 315)',
		'oklch(0.42 0.1 305)',
		'oklch(0.25 0.06 305)'
	],
	fabled: ['oklch(0.82 0.14 95)', 'oklch(0.9 0.1 98)', 'oklch(0.6 0.12 90)', 'oklch(0.32 0.07 90)']
} as const satisfies Record<string, Material>;
export type LaurelColour = keyof typeof LAUREL_COLOURS;

// Plain colour names only (Trevor, 2026-10-28: "no additional words like Townsfolk blue").
export const LAUREL_COLOUR_NAMES: Record<LaurelColour, string> = {
	accent: 'Accent',
	bronze: 'Bronze',
	silver: 'Silver',
	gold: 'Gold',
	green: 'Green',
	townsfolk: 'Blue',
	outsider: 'Cyan',
	minion: 'Orange',
	demon: 'Red',
	traveller: 'Purple',
	fabled: 'Yellow'
};

export interface LaurelSpec {
	form: LaurelForm;
	colour: LaurelColour;
	/** Leaves on each side, outer and inner together count as one. */
	leaves?: number;
	/** Branches meet at the top. */
	closed?: boolean;
}

/** Leaf length and width (as a share of the length) for each form. */
const LEAF: Record<LaurelForm, { length: number; width: number }> = {
	laurel: { length: 11, width: 0.36 },
	olive: { length: 12, width: 0.2 },
	myrtle: { length: 8, width: 0.5 },
	ivy: { length: 9, width: 0.5 },
	feather: { length: 12, width: 0.22 },
	briar: { length: 9, width: 0.22 }
};

const STEM_RADIUS = 42.5;
const round = (n: number) => Math.round(n * 100) / 100;

/** A point `r` from the centre, `degrees` clockwise from the top. */
function at(r: number, degrees: number): [number, number] {
	const radians = (degrees * Math.PI) / 180;
	return [round(50 + r * Math.sin(radians)), round(50 - r * Math.cos(radians))];
}

/** One leaf from (x, y), pointing `degrees` clockwise from the top: its outline and its lit half. */
function leaf(form: LaurelForm, x: number, y: number, degrees: number, length: number) {
	const a = (degrees * Math.PI) / 180;
	const [ux, uy] = [Math.sin(a), -Math.cos(a)];
	// Along the leaf by s, across it by t.
	const p = (s: number, t: number) => `${round(x + ux * s - uy * t)} ${round(y + uy * s + ux * t)}`;
	const w = length * LEAF[form].width;
	const base = p(0, 0);
	const tip = p(length, 0);
	if (form === 'briar') {
		// A thorn: a sharp spike off a thick stem.
		const side = `M${p(0, w)}Q${p(length * 0.5, w * 0.5)} ${tip}`;
		return { full: `${side}Q${p(length * 0.4, -w * 0.2)} ${p(0, -w)}Z`, half: `${side}L${base}Z` };
	}
	if (form === 'ivy') {
		const side = `M${base}C${p(length * 0.1, w)} ${p(length * 0.45, w * 1.1)} ${p(length * 0.5, w * 0.55)}L${tip}`;
		return {
			full: `${side}L${p(length * 0.5, -w * 0.55)}C${p(length * 0.45, -w * 1.1)} ${p(length * 0.1, -w)} ${base}Z`,
			half: `${side}Z`,
			rib: `M${base}L${p(length * 0.85, 0)}`
		};
	}
	const side = `M${base}C${p(length * 0.3, w)} ${p(length * 0.75, w * 0.8)} ${tip}`;
	let rib = `M${base}L${p(length * 0.85, 0)}`;
	if (form === 'feather') {
		for (const f of [0.3, 0.45, 0.6, 0.75]) {
			rib += `M${p(length * f, 0)}L${p(length * (f + 0.12), w * 0.9)}`;
			rib += `M${p(length * f, 0)}L${p(length * (f + 0.12), -w * 0.9)}`;
		}
	}
	return {
		full: `${side}C${p(length * 0.75, -w * 0.8)} ${p(length * 0.3, -w)} ${base}Z`,
		half: `${side}Z`,
		rib
	};
}

/** The laurel's shapes: two branches up the sides, from near the bottom towards the top. */
export function drawLaurel(spec: LaurelSpec): FrameShape[] {
	const [base, light, dark, ink] = LAUREL_COLOURS[spec.colour];
	const { length } = LEAF[spec.form];
	const leaves = spec.leaves ?? 8;
	const from = 166;
	const to = spec.closed ? 7 : 24;
	const shapes: FrameShape[] = [];
	for (const side of [1, -1]) {
		const stem: string[] = [];
		for (let d = from; d >= to - 2; d -= 4) stem.push(at(STEM_RADIUS, side * d).join(' '));
		let full = '';
		let half = '';
		let rib = '';
		for (let i = 0; i < leaves; i++) {
			const t = leaves === 1 ? 0 : i / (leaves - 1);
			const degrees = from - 4 - t * (from - 4 - to);
			const size = length * (1 - t * 0.35);
			// Up the branch: anticlockwise on the right (side 1), clockwise on the left.
			const along = side * degrees - side * 90;
			for (const outer of [true, false]) {
				// Inner leaves sit a little lower and lean less towards the face.
				const [x, y] = at(STEM_RADIUS, side * (degrees - (outer ? 0 : 4.5)));
				const direction = outer ? along + side * 34 : along - side * 22;
				const shape = leaf(spec.form, x, y, direction, outer ? size : size * 0.72);
				full += shape.full;
				half += shape.half;
				rib += shape.rib ?? '';
			}
		}
		const stemWidth = spec.form === 'briar' ? 2.4 : 1.3;
		// The outline first: the stem and every leaf drawn wider in the dark ink, then the leaves.
		shapes.push({ shape: 'path', d: `M${stem.join('L')}`, stroke: ink, width: stemWidth + 1 });
		shapes.push({ shape: 'path', d: full, fill: ink, stroke: ink, width: 1.3 });
		shapes.push({ shape: 'path', d: full, fill: base });
		shapes.push({ shape: 'path', d: half, fill: light, opacity: 0.85 });
		if (rib) shapes.push({ shape: 'path', d: rib, stroke: dark, width: 0.5, opacity: 0.8 });
	}
	return shapes;
}
