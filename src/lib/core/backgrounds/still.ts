/**
 * Still board backgrounds (M72, Trevor 2026-11-06): Felt, Parchment, Stone and Velvet, drawn
 * in CSS with SVG noise for their texture, so there is nothing to license or precache. Each
 * has its own settings like the animated ones (Trevor: "if some are similar, just let users
 * control the settings"), so a slate is Stone in a blue-grey.
 *
 * A still background is shared with the table's grims by its id and settings, and every phone
 * draws the same CSS.
 */
import { cleanParams, colour, paramDefaults, range, type ParamSet, type Params } from './params.ts';

export const STILL_IDS = ['felt', 'parchment', 'stone', 'velvet'] as const;
export type StillId = (typeof STILL_IDS)[number];

/** Which noise gives a background its surface. */
type Surface = 'cloth' | 'paper' | 'rock' | 'pile';

export interface StillBackground extends ParamSet {
	id: StillId;
	surface: Surface;
	/** How much the board dims it, so seat names stay readable on a light one. */
	dim: number;
}

const light = (value: number) => range('light', 'Light', value, [0, 1, 0.05], 'percent');
const texture = range('texture', 'Texture', 1, [0, 2, 0.05], 'times');

export const STILL_BACKGROUNDS: Readonly<Record<StillId, StillBackground>> = {
	felt: {
		id: 'felt',
		label: 'Felt',
		surface: 'cloth',
		dim: 0.85,
		params: [colour('base', 'Colour', '#064425'), light(0.35), texture],
		presets: {
			Green: {},
			Blue: { base: '#073b5e' },
			Red: { base: '#5c1717' },
			Purple: { base: '#392855' }
		}
	},
	parchment: {
		id: 'parchment',
		label: 'Parchment',
		surface: 'paper',
		dim: 0.55,
		params: [colour('base', 'Colour', '#ccb48c'), light(0.6), texture],
		presets: {
			Aged: {},
			Pale: { base: '#dad0b8', texture: 0.6 },
			Weathered: { base: '#b08a64', texture: 1.5 }
		}
	},
	stone: {
		id: 'stone',
		label: 'Stone',
		surface: 'rock',
		dim: 0.85,
		params: [colour('base', 'Colour', '#423c37'), light(0.25), texture],
		presets: {
			Granite: {},
			Slate: { base: '#283239', light: 0.2 },
			Sandstone: { base: '#72604a', light: 0.3 }
		}
	},
	velvet: {
		id: 'velvet',
		label: 'Velvet',
		surface: 'pile',
		dim: 0.85,
		params: [
			colour('base', 'Colour', '#52020d'),
			light(0),
			texture,
			range('folds', 'Folds', 1, [0, 2, 0.05], 'times')
		],
		presets: {
			Crimson: {},
			Plum: { base: '#3a0f38' },
			Midnight: { base: '#0c1c45' },
			Emerald: { base: '#00341a' }
		}
	}
};

export const isStillId = (id: unknown): id is StillId =>
	typeof id === 'string' && (STILL_IDS as readonly string[]).includes(id);

export interface StillChoice {
	id: StillId;
	params: Params;
}

export const stillDefaults = (id: StillId): Params => paramDefaults(STILL_BACKGROUNDS[id]);

/**
 * A saved or shared still background, cleaned up. A choice saved before still backgrounds had
 * settings has none, and takes the defaults; an id that is gone (Dark wood and Night sky,
 * removed 2026-11-06) gives undefined, which shows as no background.
 */
export function parseStill(raw: unknown): StillChoice | undefined {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
	const { id, params } = raw as { id?: unknown; params?: unknown };
	if (!isStillId(id)) return undefined;
	return { id, params: cleanParams(STILL_BACKGROUNDS[id], params) };
}

/** Grey noise as an SVG picture: `frequency` sets its grain, `alpha` how strongly it shows. */
function noise(
	size: [number, number],
	frequency: string,
	octaves: number,
	seed: number,
	[red, green, blue]: [number, number, number],
	[gain, offset]: [number, number]
): string {
	const n = (v: number) => Number(v.toFixed(3));
	const matrix = `0 0 0 0 ${red}  0 0 0 0 ${green}  0 0 0 0 ${blue}  ${n(gain)} 0 0 0 ${n(offset)}`;
	const svg =
		`<svg xmlns='http://www.w3.org/2000/svg' width='${size[0]}' height='${size[1]}'>` +
		`<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' ` +
		`numOctaves='${octaves}' seed='${seed}'/><feColorMatrix values='${matrix}'/></filter>` +
		`<rect width='100%' height='100%' filter='url(#n)'/></svg>`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`;
}

/** Fine fuzz, as on felt and stone. */
const fuzz = (strength: number) =>
	noise([200, 200], '0.85', 2, 2, [0, 0, 0], [0.9 * strength, -0.25 * strength]);
/** Large soft patches, light and dark. */
const mottle = (strength: number) =>
	noise([500, 500], '0.012', 5, 21, [0, 0, 0], [1.3 * strength, -0.45 * strength]);
/** Paper's tooth: fine and warm. */
const tooth = (strength: number) =>
	noise([200, 200], '0.5', 2, 6, [0.25, 0.15, 0.05], [0.45 * strength, -0.12 * strength]);
/** Old stains on paper. */
const blotch = (strength: number) =>
	noise([500, 500], '0.008', 5, 11, [0.35, 0.2, 0.06], [1.6 * strength, -0.62 * strength]);
/** Velvet's long folds, catching the light. */
const folds = (strength: number) =>
	noise([600, 300], '0.012 0.0015', 3, 9, [1, 0.75, 0.75], [1.3 * strength, -0.5 * strength]);

const LAYERS: Record<Surface, (t: number, params: Params) => string[]> = {
	cloth: (t) => [`${fuzz(t)} 0 0 / 12rem 12rem`, `${mottle(t)} 0 0 / 30rem 30rem`],
	paper: (t) => [`${blotch(t)} 0 0 / 34rem 34rem`, `${tooth(t)} 0 0 / 14rem 14rem`],
	rock: (t) => [`${fuzz(t)} 0 0 / 9rem 9rem`, `${mottle(t)} 0 0 / 22rem 22rem`],
	pile: (t, params) => [
		`${folds(Number(params.folds ?? 1))} 0 0 / 100% 100%`,
		`${fuzz(t)} 0 0 / 10rem 10rem`
	]
};

/** The CSS `background` that draws a still background with its settings. */
export function stillCss({ id, params }: StillChoice): string {
	const bg = STILL_BACKGROUNDS[id];
	const base = String(params.base);
	const lit = Number(params.light ?? 0);
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	return [
		// A lamp over the middle of the table, a lighter shade of the colour.
		...(lit > 0
			? [
					`radial-gradient(ellipse 75% 65% at 50% 40%, color-mix(in oklch, color-mix(in oklch, ${base}, #ffffff 35%) ${pct(lit)}, transparent), transparent 70%)`
				]
			: []),
		// Its own edges fall into shadow, a darker shade of the colour.
		`radial-gradient(ellipse 110% 100% at 50% 50%, transparent 55%, color-mix(in oklch, color-mix(in oklch, ${base}, #000000 65%) 70%, transparent) 100%)`,
		...LAYERS[bg.surface](Number(params.texture ?? 1), params),
		base
	].join(', ');
}
