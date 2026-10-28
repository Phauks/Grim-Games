/**
 * Frames around seat tokens (Trevor, 2026-10-22: "frame framework"). A frame is a data entry:
 * an id, a name, its drawing as plain SVG shapes, and room for an unlock rule (the later
 * achievements item, A1, e.g. "Clock face after 12 games"). Every frame is unlocked for now.
 *
 * The drawings are our own (research/frames.md), never Clocktower art. They are drawn in a
 * 100 by 100 box around a token whose face shrinks to a circle of radius `FACE_RADIUS`, so a
 * frame sits inside the token's own footprint and never moves a name or a reminder. Frames
 * carry no game meaning, so none can be mistaken for a dead, drunk or poisoned mark.
 */

import {
	drawLaurel,
	LAUREL_COLOURS,
	LAUREL_FACE_RADIUS,
	LAUREL_FORM_NAMES,
	LAUREL_FORMS,
	type LaurelColour,
	type LaurelForm
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

export interface Frame {
	id: string;
	name: string;
	/** Empty for the frame that draws nothing. */
	drawing: readonly FrameShape[];
	unlock?: FrameUnlock;
	/** The face's radius inside this frame, when it is not `FACE_RADIUS`. */
	faceRadius?: number;
	/** A laurel's form and colour (A1); the colour can be changed, the form is the frame. */
	laurel?: { form: LaurelForm; colour: LaurelColour };
}

// Frames are pictures, so their colours are their own (like the board backgrounds), except
// the simple ring, which takes the theme's accent.
const GOLD = 'oklch(0.82 0.12 85)';
const GOLD_DEEP = 'oklch(0.6 0.11 80)';
const IVORY = 'oklch(0.92 0.03 85)';
const WINE = 'oklch(0.42 0.12 20)';
const VINE = 'oklch(0.48 0.1 145)';
const LEAF = 'oklch(0.68 0.13 140)';
const GLOW = 'oklch(0.78 0.15 65)';

const round = (n: number) => Math.round(n * 100) / 100;

/** A point `r` from the centre, `degrees` clockwise from the top. */
function at(r: number, degrees: number): [number, number] {
	const radians = (degrees * Math.PI) / 180;
	return [round(50 + r * Math.sin(radians)), round(50 - r * Math.cos(radians))];
}

function clockFace(): FrameShape[] {
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
		{ shape: 'path', d: minor, stroke: IVORY, width: 0.6, opacity: 0.7 },
		{ shape: 'path', d: major, stroke: IVORY, width: 1.8 }
	];
}

function scalloped(): FrameShape[] {
	return Array.from({ length: 24 }, (_, i) => {
		const [cx, cy] = at(46, i * 15);
		return { shape: 'circle', cx, cy, r: 3.6, fill: WINE };
	});
}

function vines(): FrameShape[] {
	const points = Array.from({ length: 145 }, (_, i) => {
		const degrees = i * 2.5;
		return at(46 + 1.8 * Math.sin((degrees * 12 * Math.PI) / 180), degrees);
	});
	const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('') + 'Z';
	// A leaf on every crest of the vine, pointing along it.
	const leaves = Array.from({ length: 12 }, (_, i): FrameShape => {
		const degrees = i * 30 + 7.5;
		const [cx, cy] = at(47.4, degrees);
		return { shape: 'ellipse', cx, cy, rx: 2.6, ry: 1.2, rotate: degrees + 30, fill: LEAF };
	});
	return [{ shape: 'path', d, stroke: VINE, width: 1.4 }, ...leaves];
}

/** A soft light round the face: rings fading outwards, no line. */
function candleGlow(): FrameShape[] {
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
		stroke: GLOW,
		width: 2.4,
		opacity
	}));
}

/**
 * Every fixed frame, in the order they are offered (research/frames.md). The laurels follow
 * them, one per form, each in any of the laurel colours.
 */
export const FRAMES: readonly Frame[] = [
	{ id: 'none', name: 'None', drawing: [] },
	{
		id: 'ring',
		name: 'Simple ring',
		drawing: [{ shape: 'circle', cx: 50, cy: 50, r: 46, stroke: 'var(--accent)', width: 5 }]
	},
	{
		id: 'double-gold',
		name: 'Double gold',
		drawing: [
			{ shape: 'circle', cx: 50, cy: 50, r: 48.6, stroke: GOLD, width: 2.2 },
			{ shape: 'circle', cx: 50, cy: 50, r: 46.3, stroke: GOLD_DEEP, width: 1.4 },
			{ shape: 'circle', cx: 50, cy: 50, r: 44, stroke: GOLD, width: 1.6 }
		]
	},
	{ id: 'clock', name: 'Clock face', drawing: clockFace() },
	{ id: 'scalloped', name: 'Scalloped', drawing: scalloped() },
	{ id: 'vines', name: 'Vines', drawing: vines() },
	{ id: 'candle', name: 'Candle glow', drawing: candleGlow() }
];

/** The colour a laurel takes until its player picks another. */
export const DEFAULT_LAUREL_COLOUR: LaurelColour = 'gold';

/** A laurel's frame id, such as `laurel-olive-gold`. */
export function laurelFrameId(form: LaurelForm, colour: LaurelColour): FrameId {
	return `laurel-${form}-${colour}`;
}

const laurels = new Map<FrameId, Frame>();

/** The laurel frame of this form and colour, drawn once and kept. */
export function laurelFrame(form: LaurelForm, colour: LaurelColour): Frame {
	const id = laurelFrameId(form, colour);
	let frame = laurels.get(id);
	if (!frame) {
		frame = {
			id,
			name: LAUREL_FORM_NAMES[form],
			drawing: drawLaurel({ form, colour }),
			faceRadius: LAUREL_FACE_RADIUS,
			laurel: { form, colour }
		};
		laurels.set(id, frame);
	}
	return frame;
}

const isForm = (raw: string): raw is LaurelForm =>
	(LAUREL_FORMS as readonly string[]).includes(raw);
const isColour = (raw: string): raw is LaurelColour => Object.hasOwn(LAUREL_COLOURS, raw);

/** The laurel an id names. The old single `laurel` frame (before A1) is now the gold Laurel. */
function laurelById(id: FrameId): Frame | undefined {
	if (id === 'laurel') return laurelFrame('laurel', DEFAULT_LAUREL_COLOUR);
	const [kind, form, colour, ...rest] = id.split('-');
	if (kind !== 'laurel' || rest.length || !isForm(form) || !isColour(colour)) return undefined;
	return laurelFrame(form, colour);
}

export type FrameId = string;

/** The frame a board uses until the Storyteller picks another: none, as before frames. */
export const DEFAULT_FRAME: FrameId = 'none';

/** The frame with this id, if there is one. */
export function frameById(id: FrameId | undefined): Frame | undefined {
	if (id === undefined) return undefined;
	return FRAMES.find((frame) => frame.id === id) ?? laurelById(id);
}

/** A saved frame id, kept only when it names a frame; otherwise undefined. */
export function parseFrameId(raw: unknown): FrameId | undefined {
	return typeof raw === 'string' ? frameById(raw)?.id : undefined;
}

/** True when the frame has no unlock rule, or the progress meets it. */
export function isFrameUnlocked(frame: Frame, progress?: FrameProgress): boolean {
	const rule = frame.unlock;
	if (!rule) return true;
	if (!progress) return false;
	return (rule.kind === 'gamesPlayed' ? progress.gamesPlayed : progress.accolades) >= rule.count;
}

/** The frames a player may pick, with the laurels in `colour`. */
export function unlockedFrames(
	progress?: FrameProgress,
	colour: LaurelColour = DEFAULT_LAUREL_COLOUR
): Frame[] {
	const all = [...FRAMES, ...LAUREL_FORMS.map((form) => laurelFrame(form, colour))];
	return all.filter((frame) => isFrameUnlocked(frame, progress));
}

/**
 * The frame a seat shows: the player's own laurel when it names one (their phone only offers
 * the ones they have unlocked), otherwise none. There is no board default: a laurel is the
 * player's own (Trevor, 2026-10-27).
 */
export function seatFrame(playerFrame: FrameId | undefined): Frame {
	return frameById(playerFrame) ?? (frameById(DEFAULT_FRAME) as Frame);
}
