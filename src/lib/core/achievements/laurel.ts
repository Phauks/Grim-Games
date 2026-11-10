/**
 * The laurel generator: draws a laurel's form in a chosen colour as frame shapes, so a laurel
 * draws wherever a frame does (seat tokens, the player's grim, the profile). Our own drawing,
 * never Clocktower art (research/frames.md).
 *
 * Each laurel is a full wreath: one stem all the way round with the same group of leaves
 * repeated evenly, every leaf leaning clockwise, so it has no top or bottom and looks the same
 * while it turns (Trevor, 2026-11-10: "new leaf based laurels are much better"; review page
 * https://claude.ai/artifact/T1eYXDWsbQb3YjiEaxyEAi). Leaves big enough to read need a wider
 * band than other frames, so the face shrinks to `LAUREL_FACE_RADIUS`. Each leaf has a dark
 * outline, a base, a lighter half and a midrib: the outline keeps leaves apart at a phone's seat
 * size. Each layer is one path, so a laurel is at most ten shapes however many leaves it has,
 * which keeps a full town light to draw.
 */
import type { FrameShape } from '#lib/core/frames/index.ts';

/** The face's radius, in the 100 by 100 box, inside a laurel (frames use `FACE_RADIUS`). */
export const LAUREL_FACE_RADIUS = 35;

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
	/** How many times the group of leaves repeats round the wreath; each form has its own. */
	leaves?: number;
}

type Point = readonly [number, number];
type LeafKind = 'laurel' | 'round' | 'ivy' | 'feather' | 'leaflets';

/** How a form's wreath is laid out (review page, round 2). */
interface Wreath {
	/** Groups of leaves round the wreath. */
	nodes: number;
	length: number;
	/** Leaf width, as a share of its length. */
	width: number;
	/** Lean away from the stem, in degrees, of the outer and inner leaves. */
	outerAngle: number;
	innerAngle?: number;
	innerScale?: number;
	/** Pairs: an outer and inner leaf together. Stagger: inner leaves halfway between. */
	pattern: 'pairs' | 'stagger' | 'alternate' | 'single';
	shape: LeafKind;
	stemRadius?: number;
	/** No stem drawn when 0. */
	stemWidth?: number;
	/** The outline's width round each leaf. */
	ink?: number;
	/** How far the stem waves in and out. */
	wave?: number;
	/** Uneven leaf angles, in degrees, and sizes. */
	jitter?: number;
	thorns?: boolean;
	fruit?: { every: number; radius: number; out: number; paint: 'base' | 'dark' };
}

const WREATHS: Record<LaurelForm, Wreath> = {
	// Bay leaves, long and pointed, outer and inner rows staggered.
	laurel: {
		nodes: 16,
		length: 9,
		width: 0.34,
		outerAngle: 30,
		innerAngle: 26,
		innerScale: 0.8,
		pattern: 'stagger',
		shape: 'laurel'
	},
	// Narrow leaves in opposite pairs, close to the stem, an olive every third pair.
	olive: {
		nodes: 15,
		length: 10.5,
		width: 0.19,
		outerAngle: 20,
		innerAngle: 18,
		innerScale: 0.9,
		pattern: 'pairs',
		shape: 'laurel',
		fruit: { every: 3, radius: 1.9, out: 2.6, paint: 'base' }
	},
	// A dense band of small oval leaves in tight pairs, with dark berries.
	myrtle: {
		nodes: 26,
		length: 5.6,
		width: 0.52,
		outerAngle: 42,
		innerAngle: 38,
		innerScale: 0.9,
		pattern: 'pairs',
		shape: 'round',
		fruit: { every: 4, radius: 1.4, out: 3.6, paint: 'dark' }
	},
	// Three-lobed leaves on a gently waving vine, alternating out and in, slightly uneven.
	ivy: {
		nodes: 18,
		length: 7.8,
		width: 0.62,
		outerAngle: 48,
		innerAngle: 36,
		innerScale: 0.8,
		pattern: 'alternate',
		shape: 'ivy',
		wave: 0.9,
		jitter: 14,
		stemRadius: 42.6
	},
	// Long feathers overlapping like a ruff, with no stem.
	feather: {
		nodes: 22,
		length: 17,
		width: 0.22,
		outerAngle: 11,
		pattern: 'single',
		shape: 'feather',
		stemRadius: 41.4,
		stemWidth: 0,
		ink: 1.1
	},
	// A thorny cane with rose leaves of three leaflets and a rose hip every third leaf.
	briar: {
		nodes: 16,
		length: 8.8,
		width: 0.62,
		outerAngle: 44,
		innerAngle: 34,
		innerScale: 0.75,
		pattern: 'alternate',
		shape: 'leaflets',
		thorns: true,
		stemRadius: 42,
		stemWidth: 2,
		fruit: { every: 3, radius: 1.9, out: 0.2, paint: 'dark' }
	}
};

const round = (n: number) => Math.round(n * 100) / 100;
const pt = ([x, y]: Point) => `${round(x)} ${round(y)}`;
const unit = ([x, y]: Point): Point => {
	const length = Math.hypot(x, y) || 1;
	return [x / length, y / length];
};
const turn = ([x, y]: Point, degrees: number): Point => {
	const a = (degrees * Math.PI) / 180;
	return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};

/** A point `r` from the centre, `degrees` clockwise from the top. */
function at(r: number, degrees: number): Point {
	const radians = (degrees * Math.PI) / 180;
	return [50 + r * Math.sin(radians), 50 - r * Math.cos(radians)];
}

/** The same numbers every time: ivy's uneven leaves must not change between draws. */
function seeded(seed: number) {
	let s = seed;
	return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * One leaf from `from`, pointing along `dir`, `length` long and `width` wide each side of its
 * midrib: its whole outline, its lit half and its rib.
 */
export function leafPaths(
	kind: Exclude<LeafKind, 'leaflets'>,
	from: Point,
	dir: Point,
	length: number,
	width: number
): { full: string; half: string; rib: string } {
	const across: Point = [-dir[1], dir[0]];
	const p = (s: number, t: number): string =>
		pt([from[0] + dir[0] * s + across[0] * t, from[1] + dir[1] * s + across[1] * t]);
	const [L, w] = [length, width];
	const base = pt(from);
	const tip = p(L, 0);
	const rib = `M${base}L${p(L * 0.82, 0)}`;
	if (kind === 'ivy') {
		const side = (k: number) =>
			`C${p(0.02 * L, 0.7 * w * k)} ${p(0.2 * L, 1.15 * w * k)} ${p(0.38 * L, 1.05 * w * k)}L${p(0.48 * L, 0.45 * w * k)}`;
		const lit = `M${base}${side(1)}L${tip}`;
		return {
			full: `${lit}L${p(0.48 * L, -0.45 * w)}L${p(0.38 * L, -1.05 * w)}C${p(0.2 * L, -1.15 * w)} ${p(0.02 * L, -0.7 * w)} ${base}Z`,
			half: `${lit}L${p(0.4 * L, 0)}Z`,
			rib: `${rib}M${p(0.15 * L, 0)}L${p(0.34 * L, 0.8 * w)}M${p(0.15 * L, 0)}L${p(0.34 * L, -0.8 * w)}`
		};
	}
	if (kind === 'feather') {
		// A long vane, widest past the middle, with barbs angled back to the shaft.
		const lit = `M${p(L * 0.1, 0)}C${p(L * 0.35, w * 1.1)} ${p(L * 0.8, w * 1.05)} ${tip}`;
		let barbs = '';
		for (let i = 0; i < 6; i++) {
			const s = L * (0.28 + i * 0.11);
			barbs += `M${p(s, 0)}L${p(s + L * 0.09, w * 0.9)}M${p(s, 0)}L${p(s + L * 0.09, -w * 0.9)}`;
		}
		return {
			full: `${lit}C${p(L * 0.8, -w * 1.05)} ${p(L * 0.35, -w * 1.1)} ${p(L * 0.1, 0)}Z`,
			half: `${lit}L${p(L * 0.1, 0)}Z`,
			rib: `M${base}L${p(L * 0.96, 0)}${barbs}`
		};
	}
	const k = kind === 'round' ? [0.05, 1.3, 0.8, 1.2] : [0.25, 1, 0.7, 0.85];
	const lit = `M${base}C${p(L * k[0], w * k[1])} ${p(L * k[2], w * k[3])} ${tip}`;
	return {
		full: `${lit}C${p(L * k[2], -w * k[3])} ${p(L * k[0], -w * k[1])} ${base}Z`,
		half: `${lit}Z`,
		rib
	};
}

/** A small round fruit as a path of four curves, so many fruits stay one shape. */
function dot([x, y]: Point, r: number): string {
	const c = r * 0.5523;
	return (
		`M${pt([x, y - r])}C${pt([x + c, y - r])} ${pt([x + r, y - c])} ${pt([x + r, y])}` +
		`C${pt([x + r, y + c])} ${pt([x + c, y + r])} ${pt([x, y + r])}` +
		`C${pt([x - c, y + r])} ${pt([x - r, y + c])} ${pt([x - r, y])}` +
		`C${pt([x - r, y - c])} ${pt([x - c, y - r])} ${pt([x, y - r])}Z`
	);
}

/** The laurel's shapes: a full wreath, the same all the way round. */
export function drawLaurel(spec: LaurelSpec): FrameShape[] {
	const [base, light, dark, ink] = LAUREL_COLOURS[spec.colour];
	const o = WREATHS[spec.form];
	const nodes = spec.leaves ?? o.nodes;
	const R = o.stemRadius ?? 43.4;
	const rand = seeded(9);
	const stemAt = (deg: number) =>
		at(R + (o.wave ? Math.sin((deg * nodes * Math.PI) / 180) * o.wave : 0), deg);
	const tangent = (deg: number): Point => {
		const [a, b] = [stemAt(deg), stemAt(deg + 0.5)];
		return unit([b[0] - a[0], b[1] - a[1]]);
	};
	const outward = (p: Point) => unit([p[0] - 50, p[1] - 50]);
	let full = '';
	let half = '';
	let rib = '';
	let thorns = '';
	let fruit = '';
	let shine = '';

	/** A leaf on the stem at `deg`, outside it (side 1) or inside (-1), leaning clockwise. */
	const leafAt = (deg: number, side: number, length: number, angle: number) => {
		const b = stemAt(deg);
		const [T, N] = [tangent(deg), outward(b)];
		const a = (angle * Math.PI) / 180;
		const dir = unit([
			T[0] * Math.cos(a) + side * N[0] * Math.sin(a),
			T[1] * Math.cos(a) + side * N[1] * Math.sin(a)
		]);
		if (o.shape === 'leaflets') {
			// A rose leaf: a short stalk with three round leaflets.
			const end: Point = [b[0] + dir[0] * length * 0.5, b[1] + dir[1] * length * 0.5];
			rib += `M${pt(b)}L${pt(end)}`;
			for (const by of [-42, 0, 42]) {
				const from: Point = by
					? [b[0] + dir[0] * length * 0.32, b[1] + dir[1] * length * 0.32]
					: end;
				const l = leafPaths('round', from, turn(dir, by), length * 0.48, length * 0.48 * o.width);
				full += l.full;
				half += l.half;
			}
			return;
		}
		const l = leafPaths(o.shape, b, dir, length, length * o.width);
		full += l.full;
		half += l.half;
		rib += l.rib;
	};

	const step = 360 / nodes;
	const inner = o.innerAngle ?? o.outerAngle;
	for (let i = 0; i < nodes; i++) {
		const deg = i * step;
		const nudge = () => (o.jitter ? (rand() - 0.5) * o.jitter : 0);
		const size = () => 1 + (o.jitter ? (rand() - 0.5) * 0.18 : 0);
		if (o.pattern === 'pairs') {
			leafAt(deg, 1, o.length * size(), o.outerAngle + nudge());
			leafAt(deg, -1, o.length * (o.innerScale ?? 0.85) * size(), inner + nudge());
		} else if (o.pattern === 'stagger') {
			leafAt(deg, 1, o.length * size(), o.outerAngle + nudge());
			leafAt(deg + step / 2, -1, o.length * (o.innerScale ?? 0.8) * size(), inner + nudge());
		} else if (o.pattern === 'alternate') {
			const out = i % 2 === 0;
			const length = o.length * (out ? 1 : (o.innerScale ?? 0.85)) * size();
			leafAt(deg, out ? 1 : -1, length, (out ? o.outerAngle : inner) + nudge());
		} else {
			leafAt(deg, 1, o.length * size(), o.outerAngle + nudge());
		}
		if (o.fruit && i % o.fruit.every === 0) {
			const b = stemAt(deg + step * 0.5);
			const N = outward(b);
			const c: Point = [b[0] + N[0] * o.fruit.out, b[1] + N[1] * o.fruit.out];
			fruit += dot(c, o.fruit.radius);
			shine += dot([c[0] - 0.45, c[1] - 0.45], 0.5);
		}
		if (o.thorns) {
			for (const side of [1, -1]) {
				const d = deg + step * (side === 1 ? 0.3 : 0.75);
				const b = stemAt(d);
				const [T, N] = [tangent(d), outward(b)];
				const tip: Point = [
					b[0] + side * N[0] * 3 - T[0] * 1.6,
					b[1] + side * N[1] * 3 - T[1] * 1.6
				];
				thorns += `M${pt([b[0] + T[0] * 1.3, b[1] + T[1] * 1.3])}L${pt(tip)}L${pt([b[0] - T[0] * 0.9, b[1] - T[1] * 0.9])}Z`;
			}
		}
	}

	const stem: string[] = [];
	for (let d = 0; d < 360; d += 2) stem.push(pt(stemAt(d)));
	const stemD = `M${stem.join('L')}Z`;
	const stemWidth = o.stemWidth ?? 1.3;
	const shapes: FrameShape[] = [];
	// The outline first: the stem and every leaf drawn wider in the dark ink, then the leaves.
	if (stemWidth > 0) shapes.push({ shape: 'path', d: stemD, stroke: ink, width: stemWidth + 1.1 });
	if (thorns) shapes.push({ shape: 'path', d: thorns, fill: dark, stroke: ink, width: 0.7 });
	shapes.push({ shape: 'path', d: full, fill: ink, stroke: ink, width: o.ink ?? 1.3 });
	if (stemWidth > 0) shapes.push({ shape: 'path', d: stemD, stroke: dark, width: stemWidth });
	shapes.push({ shape: 'path', d: full, fill: base });
	shapes.push({ shape: 'path', d: half, fill: light, opacity: 0.9 });
	if (rib) shapes.push({ shape: 'path', d: rib, stroke: dark, width: 0.45, opacity: 0.85 });
	if (fruit) {
		const paint = o.fruit?.paint === 'base' ? base : dark;
		shapes.push({ shape: 'path', d: fruit, fill: paint, stroke: ink, width: 0.8 });
		shapes.push({ shape: 'path', d: shine, fill: light });
	}
	return shapes;
}
