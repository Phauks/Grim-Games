/**
 * Frames around seat tokens (Trevor, 2026-10-22: "frame framework"). A frame is a data entry:
 * an id, a name, its drawing as plain SVG shapes, and room for an unlock rule (the later
 * achievements item, A1, e.g. "Clock face after 12 games"). Every frame is unlocked for now.
 *
 * The drawings are our own (research/frames.md), never Clocktower art. They are drawn in a
 * 100 by 100 box whose inner circle, of radius `FACE_RADIUS`, is the token's face. On a seat
 * the face keeps its size and the frame is drawn round it, past the token's edge (Trevor,
 * 2026-10-31: every token the same size), so it never moves a name or a reminder. Frames
 * carry no game meaning, so none can be mistaken for a dead, drunk or poisoned mark.
 *
 * Every frame but None is a form drawn in a colour, any form in any colour (Trevor,
 * 2026-10-28: "Color", for the laurels and the other frames alike), and may move.
 */

import {
	drawLaurel,
	LAUREL_COLOURS,
	leafPaths,
	LAUREL_FACE_RADIUS,
	LAUREL_FORM_NAMES,
	LAUREL_FORMS,
	type LaurelColour,
	type Material
} from '#lib/core/achievements/laurel.ts';

/** The face's radius, in the frame's 100 by 100 box, while a frame is drawn around it. */
export const FACE_RADIUS = 42;

/** A colour: a CSS colour or `var(--token)`, applied as a style so tokens work. */
type Paint = string;

interface Stroke {
	fill?: Paint;
	stroke?: Paint;
	/** Stroke width, in the frame's box. */
	width?: number;
	opacity?: number;
}

export type FrameShape =
	| ({ shape: 'circle'; cx: number; cy: number; r: number } & Stroke)
	| ({ shape: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotate: number } & Stroke)
	| ({ shape: 'path'; d: string } & Stroke);

/**
 * What earns a frame, once achievements exist (A1). Not used yet: every frame has none, so
 * all of them are unlocked.
 */
export type FrameUnlock =
	{ kind: 'gamesPlayed'; count: number } | { kind: 'accolades'; count: number };

/** A player's record, as far as unlock rules read it. */
export interface FrameProgress {
	gamesPlayed: number;
	accolades: number;
}

/**
 * How a frame moves (Trevor, 2026-10-28: motion in the laurel settings): a light sweeping
 * across it or round it either way, or the whole frame turning either way (sway dropped,
 * Trevor 2026-10-28: "I don't like it"), then Pulse, Breathe, Twinkle, Regrow and Flicker
 * (Trevor, 2026-10-28: "add the additional motion settings"). Plain CSS on the whole frame,
 * so a full town stays smooth; reduced motion keeps every frame still.
 */
export const FRAME_MOTIONS = [
	'none',
	'shimmer',
	'shimmer-cw',
	'shimmer-ccw',
	'rotate-cw',
	'rotate-ccw',
	'pulse',
	'breathe',
	'twinkle',
	'regrow',
	'flicker'
] as const;
export type FrameMotion = (typeof FRAME_MOTIONS)[number];

export const FRAME_MOTION_NAMES: Record<FrameMotion, string> = {
	none: 'None',
	shimmer: 'Shimmer',
	'shimmer-cw': 'Clockwise shimmer',
	'shimmer-ccw': 'Counter-clockwise shimmer',
	'rotate-cw': 'Rotate clockwise',
	'rotate-ccw': 'Rotate counter-clockwise',
	pulse: 'Pulse',
	breathe: 'Breathe',
	twinkle: 'Twinkle',
	regrow: 'Regrow',
	flicker: 'Flicker'
};

/** A frame's shape, which any colour can be drawn in. */
export interface FrameForm {
	id: string;
	name: string;
	/** The colour it takes until its player picks another. */
	colour: LaurelColour;
	draw: (colour: LaurelColour) => FrameShape[];
	/** The face's radius inside this form, when it is not `FACE_RADIUS`. */
	faceRadius?: number;
	unlock?: FrameUnlock;
}

export interface Frame {
	id: string;
	name: string;
	/** Empty for the frame that draws nothing. */
	drawing: readonly FrameShape[];
	unlock?: FrameUnlock;
	/** The face's radius inside this frame, when it is not `FACE_RADIUS`. */
	faceRadius?: number;
	/** The form and colour it is drawn in; None has neither. */
	form?: string;
	colour?: LaurelColour;
	/** How it moves; still when absent. */
	motion?: Exclude<FrameMotion, 'none'>;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** A point `r` from the centre, `degrees` clockwise from the top. */
function at(r: number, degrees: number): [number, number] {
	const radians = (degrees * Math.PI) / 180;
	return [round(50 + r * Math.sin(radians)), round(50 - r * Math.cos(radians))];
}

function clockFace([, light]: Material): FrameShape[] {
	let minor = '';
	let major = '';
	for (let tick = 0; tick < 60; tick++) {
		const degrees = tick * 6;
		const hour = tick % 5 === 0;
		const [x1, y1] = at(hour ? 43 : 46.5, degrees);
		const [x2, y2] = at(49, degrees);
		if (hour) major += `M${x1} ${y1}L${x2} ${y2}`;
		else minor += `M${x1} ${y1}L${x2} ${y2}`;
	}
	return [
		{ shape: 'path', d: minor, stroke: light, width: 0.6, opacity: 0.7 },
		{ shape: 'path', d: major, stroke: light, width: 1.8 }
	];
}

/** Part of a circle of radius `r`, clockwise from `from` to `to` degrees. */
function arc(r: number, from: number, to: number): string {
	const [x0, y0] = at(r, from);
	const [x1, y1] = at(r, to);
	return `M${x0} ${y0}A${r} ${r} 0 ${Math.abs(to - from) > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/** A metal band lit from the top left: dark outline, base, a light arc above, a dark arc below. */
function bevelBand(r: number, w: number, [base, light, dark, ink]: Material): FrameShape[] {
	return [
		{ shape: 'circle', cx: 50, cy: 50, r, stroke: ink, width: round(w + 1.4) },
		{ shape: 'circle', cx: 50, cy: 50, r, stroke: base, width: w },
		{
			shape: 'path',
			d: arc(round(r + w * 0.22), 250, 430),
			stroke: light,
			width: round(w * 0.35),
			opacity: 0.9
		},
		{
			shape: 'path',
			d: arc(round(r - w * 0.22), 70, 250),
			stroke: dark,
			width: round(w * 0.35),
			opacity: 0.7
		}
	];
}

/**
 * Two bands with a dark gap and eight studs between them (Trevor, 2026-11-09: liked it beside
 * Double ring, so it is its own frame).
 */
function studded(material: Material): FrameShape[] {
	const [, light, dark, ink] = material;
	const studs = Array.from({ length: 8 }, (_, i): FrameShape => {
		const [cx, cy] = at(46.2, i * 45 + 22.5);
		return { shape: 'circle', cx, cy, r: 1.5, fill: light, stroke: ink, width: 0.6 };
	});
	return [
		{ shape: 'circle', cx: 50, cy: 50, r: 46.2, stroke: ink, width: 7.6 },
		{ shape: 'circle', cx: 50, cy: 50, r: 46.2, stroke: dark, width: 5.4, opacity: 0.6 },
		...bevelBand(48.3, 2, material),
		...bevelBand(44.1, 1.6, material),
		...studs
	];
}

/** One solid scalloped rim, like a coin or a seal, with a dark ring inside it. */
function scalloped([base, , dark, ink]: Material): FrameShape[] {
	const count = 18;
	const span = 360 / count;
	let d = '';
	for (let i = 0; i < count; i++) {
		const from = i * span;
		const [x0, y0] = at(45.6, from);
		const [ax, ay] = at(50, from + span * 0.32);
		const [bx, by] = at(50, from + span * 0.68);
		const [x1, y1] = at(45.6, from + span);
		d += `${i ? 'L' : 'M'}${x0} ${y0}C${ax} ${ay} ${bx} ${by} ${x1} ${y1}`;
	}
	return [
		{ shape: 'path', d: `${d}Z`, fill: base, stroke: ink, width: 1.4 },
		{ shape: 'circle', cx: 50, cy: 50, r: 43.6, stroke: dark, width: 2.6 }
	];
}

/** Two strands twisting round the face, leaves on alternate sides and a few curled tendrils. */
function vines([base, light, dark, ink]: Material): FrameShape[] {
	const strand = (phase: number) => {
		const points = Array.from({ length: 180 }, (_, i) =>
			at(46.2 + 1.7 * Math.sin(((i * 16 + phase) * Math.PI) / 180), i * 2)
		);
		return `M${points.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
	};
	let full = '';
	let half = '';
	let rib = '';
	let curls = '';
	for (let i = 0; i < 16; i++) {
		const degrees = i * 22.5 + 5;
		const side = i % 2 ? 1 : -1;
		const from = at(46.2, degrees);
		const a = (degrees * Math.PI) / 180;
		const along: [number, number] = [Math.cos(a), Math.sin(a)];
		const out: [number, number] = [Math.sin(a), -Math.cos(a)];
		const lean = (40 * Math.PI) / 180;
		const dir: [number, number] = [
			along[0] * Math.cos(lean) + side * out[0] * Math.sin(lean),
			along[1] * Math.cos(lean) + side * out[1] * Math.sin(lean)
		];
		const length = side > 0 ? 5.6 : 4.6;
		const leaf = leafPaths('laurel', from, dir, length, length * 0.42);
		full += leaf.full;
		half += leaf.half;
		rib += leaf.rib;
		if (i % 4 === 2) {
			const [x, y] = at(50, degrees + 9);
			curls += `M${at(47.5, degrees + 6).join(' ')}Q${at(51, degrees + 8).join(' ')} ${x} ${y}`;
			curls += `Q${round(x - 0.8)} ${round(y - 1.2)} ${round(x - 1.6)} ${y}`;
		}
	}
	return [
		{ shape: 'path', d: strand(0) + strand(180), stroke: ink, width: 2.4 },
		{ shape: 'path', d: strand(0), stroke: dark, width: 1.2 },
		{ shape: 'path', d: strand(180), stroke: base, width: 1.2 },
		{ shape: 'path', d: curls, stroke: ink, width: 1.4 },
		{ shape: 'path', d: curls, stroke: light, width: 0.6 },
		{ shape: 'path', d: full, fill: ink, stroke: ink, width: 1.1 },
		{ shape: 'path', d: full, fill: base },
		{ shape: 'path', d: half, fill: light, opacity: 0.9 },
		{ shape: 'path', d: rib, stroke: dark, width: 0.4 }
	];
}

/** A soft light round the face: rings fading outwards, no line. */
function candleGlow([base]: Material): FrameShape[] {
	return [
		[43.2, 0.6],
		[45.2, 0.38],
		[47.2, 0.2],
		[49, 0.1]
	].map(([r, opacity]) => ({
		shape: 'circle',
		cx: 50,
		cy: 50,
		r,
		stroke: base,
		width: 2.4,
		opacity
	}));
}

/** A drawing in a colour's material. */
const painted = (draw: (material: Material) => FrameShape[]) => (colour: LaurelColour) =>
	draw(LAUREL_COLOURS[colour]);

/**
 * Every form, in the order they are offered (research/frames.md), each in the colour it was
 * drawn in before frames took any colour. The laurels follow, one per leaf.
 */
export const FRAME_FORMS: readonly FrameForm[] = [
	{
		id: 'ring',
		name: 'Simple ring',
		colour: 'accent',
		draw: painted(([base]) => [{ shape: 'circle', cx: 50, cy: 50, r: 46, stroke: base, width: 5 }])
	},
	{
		id: 'double-gold',
		name: 'Double ring',
		colour: 'gold',
		draw: painted(([base, , dark]) => [
			{ shape: 'circle', cx: 50, cy: 50, r: 48.6, stroke: base, width: 2.2 },
			{ shape: 'circle', cx: 50, cy: 50, r: 46.3, stroke: dark, width: 1.4 },
			{ shape: 'circle', cx: 50, cy: 50, r: 44, stroke: base, width: 1.6 }
		])
	},
	{ id: 'studded', name: 'Studded ring', colour: 'gold', draw: painted(studded) },
	{ id: 'clock', name: 'Clock face', colour: 'silver', draw: painted(clockFace) },
	{ id: 'scalloped', name: 'Scalloped', colour: 'demon', draw: painted(scalloped) },
	{ id: 'vines', name: 'Vines', colour: 'green', draw: painted(vines) },
	{ id: 'candle', name: 'Candle glow', colour: 'gold', draw: painted(candleGlow) },
	...LAUREL_FORMS.map((form): FrameForm => ({
		id: `laurel-${form}`,
		name: LAUREL_FORM_NAMES[form],
		colour: 'gold',
		draw: (colour) => drawLaurel({ form, colour }),
		faceRadius: LAUREL_FACE_RADIUS
	}))
];

/**
 * How far the widest frame reaches past the token's edge, as a share of the token's size:
 * the face fills the token, so a smaller face radius draws the frame further out. A screen
 * that shows one seat by itself keeps this much room round it, whatever frame is picked.
 */
export const FRAME_REACH =
	(50 / Math.min(FACE_RADIUS, ...FRAME_FORMS.map((form) => form.faceRadius ?? FACE_RADIUS)) - 1) /
	2;

export type FrameId = string;

/** The frame a seat shows until its player picks another: none, as before frames. */
export const DEFAULT_FRAME: FrameId = 'none';

const NONE: Frame = { id: DEFAULT_FRAME, name: 'None', drawing: [] };

const formById = (id: string) => FRAME_FORMS.find((form) => form.id === id);
const isColour = (raw: string): raw is LaurelColour => Object.hasOwn(LAUREL_COLOURS, raw);
const isMotion = (raw: string): raw is FrameMotion =>
	(FRAME_MOTIONS as readonly string[]).includes(raw);

/** A frame's id: its form and colour, then its motion when it moves, as `vines-gold~shimmer`. */
export function frameId(form: string, colour: LaurelColour, motion: FrameMotion = 'none'): FrameId {
	return `${form}-${colour}${motion === 'none' ? '' : `~${motion}`}`;
}

const drawn = new Map<FrameId, Frame>();

/** The frame of this form, colour and motion, drawn once and kept. */
export function frameOf(
	form: FrameForm,
	colour: LaurelColour = form.colour,
	motion: FrameMotion = 'none'
): Frame {
	const id = frameId(form.id, colour, motion);
	let frame = drawn.get(id);
	if (!frame) {
		frame = {
			id,
			name: form.name,
			drawing: form.draw(colour),
			form: form.id,
			colour,
			...(form.faceRadius === undefined ? {} : { faceRadius: form.faceRadius }),
			...(form.unlock ? { unlock: form.unlock } : {}),
			...(motion === 'none' ? {} : { motion })
		};
		drawn.set(id, frame);
	}
	return frame;
}

/**
 * The frame an id names. A form's bare id, saved before frames took a colour, is that form in
 * its own colour; the single `laurel` frame from before laurels had forms is the gold Laurel.
 */
export function frameById(id: FrameId | undefined): Frame | undefined {
	if (id === undefined) return undefined;
	if (id === DEFAULT_FRAME) return NONE;
	const [look, raw = 'none', ...more] = id.split('~');
	if (more.length) return undefined;
	// A motion no longer offered (sway, before 2026-10-28) leaves the frame still.
	const motion = isMotion(raw) ? raw : 'none';
	const bare = formById(look === 'laurel' ? 'laurel-laurel' : look);
	if (bare) return frameOf(bare, bare.colour, motion);
	const cut = look.lastIndexOf('-');
	const form = formById(look.slice(0, cut));
	const colour = look.slice(cut + 1);
	return form && isColour(colour) ? frameOf(form, colour, motion) : undefined;
}

/** A saved frame id, kept only when it names a frame; otherwise undefined. */
export function parseFrameId(raw: unknown): FrameId | undefined {
	return typeof raw === 'string' ? frameById(raw)?.id : undefined;
}

/** True when the frame has no unlock rule, or the progress meets it. */
export function isFrameUnlocked(frame: Frame | FrameForm, progress?: FrameProgress): boolean {
	const rule = frame.unlock;
	if (!rule) return true;
	if (!progress) return false;
	return (rule.kind === 'gamesPlayed' ? progress.gamesPlayed : progress.accolades) >= rule.count;
}

/**
 * The frames a player may pick: None, then every unlocked form in `colour` (each in its own
 * colour when none is given) and `motion`.
 */
export function unlockedFrames(
	progress?: FrameProgress,
	colour?: LaurelColour,
	motion: FrameMotion = 'none'
): Frame[] {
	const forms = FRAME_FORMS.filter((form) => isFrameUnlocked(form, progress));
	return [NONE, ...forms.map((form) => frameOf(form, colour ?? form.colour, motion))];
}

/** The same frame in another colour or motion; None stays None. */
export function restyleFrame(
	frame: Frame,
	change: { colour?: LaurelColour; motion?: FrameMotion }
): Frame {
	const form = frame.form === undefined ? undefined : formById(frame.form);
	if (!form) return frame;
	return frameOf(form, change.colour ?? frame.colour, change.motion ?? frame.motion ?? 'none');
}

/**
 * The frame a seat shows: the player's own when it names one (their phone only offers the
 * ones they have unlocked), otherwise none. There is no board default: a laurel is the
 * player's own (Trevor, 2026-10-27).
 */
export function seatFrame(playerFrame: FrameId | undefined): Frame {
	return frameById(playerFrame) ?? NONE;
}

/**
 * The frame's outline as a standalone SVG, for a mask: every shape in one solid paint, since a
 * mask reads only where the frame is, and `var()` colours mean nothing outside the page.
 */
export function frameMaskSvg(frame: Frame): string {
	const paint = (colour: string | undefined) => (colour ? 'currentColor' : 'none');
	const parts = frame.drawing.map((part) => {
		const style = `fill="${paint(part.fill)}" stroke="${paint(part.stroke)}" stroke-width="${part.width ?? 0}" stroke-linecap="round" stroke-linejoin="round"${part.opacity === undefined ? '' : ` opacity="${part.opacity}"`}`;
		if (part.shape === 'circle')
			return `<circle cx="${part.cx}" cy="${part.cy}" r="${part.r}" ${style}/>`;
		if (part.shape === 'ellipse')
			return `<ellipse cx="${part.cx}" cy="${part.cy}" rx="${part.rx}" ry="${part.ry}" transform="rotate(${part.rotate} ${part.cx} ${part.cy})" ${style}/>`;
		return `<path d="${part.d}" ${style}/>`;
	});
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" overflow="visible">${parts.join('')}</svg>`;
}
