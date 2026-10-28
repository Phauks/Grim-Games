/**
 * Frames around seat tokens (Trevor, 2026-10-22: "frame framework"). A frame is a data entry:
 * an id, a name, its drawing as plain SVG shapes, and room for an unlock rule (the later
 * achievements item, A1, e.g. "Clock face after 12 games"). Every frame is unlocked for now.
 *
 * The drawings are our own (research/frames.md), never Clocktower art. They are drawn in a
 * 100 by 100 box around a token whose face shrinks to a circle of radius `FACE_RADIUS`, so a
 * frame sits inside the token's own footprint and never moves a name or a reminder. Frames
 * carry no game meaning, so none can be mistaken for a dead, drunk or poisoned mark.
 *
 * Every frame but None is a form drawn in a colour, any form in any colour (Trevor,
 * 2026-10-28: "Color", for the laurels and the other frames alike), and may move.
 */

import {
	drawLaurel,
	LAUREL_COLOURS,
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
 * Trevor 2026-10-28: "I don't like it"). Plain CSS on the whole frame, so a full town stays
 * smooth; reduced motion keeps every frame still.
 */
export const FRAME_MOTIONS = [
	'none',
	'shimmer',
	'shimmer-cw',
	'shimmer-ccw',
	'rotate-cw',
	'rotate-ccw'
] as const;
export type FrameMotion = (typeof FRAME_MOTIONS)[number];

export const FRAME_MOTION_NAMES: Record<FrameMotion, string> = {
	none: 'None',
	shimmer: 'Shimmer',
	'shimmer-cw': 'Clockwise shimmer',
	'shimmer-ccw': 'Counter-clockwise shimmer',
	'rotate-cw': 'Rotate clockwise',
	'rotate-ccw': 'Rotate counter-clockwise'
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

function scalloped([base]: Material): FrameShape[] {
	return Array.from({ length: 24 }, (_, i) => {
		const [cx, cy] = at(46, i * 15);
		return { shape: 'circle', cx, cy, r: 3.6, fill: base };
	});
}

function vines([base, light]: Material): FrameShape[] {
	const points = Array.from({ length: 145 }, (_, i) => {
		const degrees = i * 2.5;
		return at(46 + 1.8 * Math.sin((degrees * 12 * Math.PI) / 180), degrees);
	});
	const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('') + 'Z';
	// A leaf on every crest of the vine, pointing along it.
	const leaves = Array.from({ length: 12 }, (_, i): FrameShape => {
		const degrees = i * 30 + 7.5;
		const [cx, cy] = at(47.4, degrees);
		return { shape: 'ellipse', cx, cy, rx: 2.6, ry: 1.2, rotate: degrees + 30, fill: light };
	});
	return [{ shape: 'path', d, stroke: base, width: 1.4 }, ...leaves];
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
