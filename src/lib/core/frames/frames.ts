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

/** Two branches of leaves up the sides, open at the top and the bottom. */
function laurel(): FrameShape[] {
	const leaves: FrameShape[] = [];
	for (const side of [1, -1]) {
		for (let i = 0; i < 9; i++) {
			// From near the bottom (165°) up to near the top (25°), on each side.
			const degrees = side * (165 - i * 17.5);
			const r = i % 2 ? 45.2 : 46.6;
			const [cx, cy] = at(r, degrees);
			leaves.push({
				shape: 'ellipse',
				cx,
				cy,
				rx: 3.6,
				ry: 1.5,
				// Along the branch, tipped outwards like a leaf on its stem.
				rotate: round(degrees - side * 30),
				fill: GOLD
			});
		}
	}
	return leaves;
}

/** Every frame, in the order they are offered (research/frames.md, all eight kept). */
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
	{ id: 'candle', name: 'Candle glow', drawing: candleGlow() },
	{ id: 'laurel', name: 'Laurel', drawing: laurel() }
];

export type FrameId = string;

/** The frame a board uses until the Storyteller picks another: none, as before frames. */
export const DEFAULT_FRAME: FrameId = 'none';

/** The frame with this id, if there is one. */
export function frameById(id: FrameId | undefined): Frame | undefined {
	return id === undefined ? undefined : FRAMES.find((frame) => frame.id === id);
}

/** A saved frame id, kept only when it names a frame; otherwise undefined. */
export function parseFrameId(raw: unknown): FrameId | undefined {
	return typeof raw === 'string' && frameById(raw) ? raw : undefined;
}

/** True when the frame has no unlock rule, or the progress meets it. */
export function isFrameUnlocked(frame: Frame, progress?: FrameProgress): boolean {
	const rule = frame.unlock;
	if (!rule) return true;
	if (!progress) return false;
	return (rule.kind === 'gamesPlayed' ? progress.gamesPlayed : progress.accolades) >= rule.count;
}

/** The frames a player may pick. */
export function unlockedFrames(progress?: FrameProgress): Frame[] {
	return FRAMES.filter((frame) => isFrameUnlocked(frame, progress));
}

/**
 * The frame a seat shows: the player's own pick when it names a frame (their phone only
 * offers the ones they have unlocked), otherwise the board's default, otherwise none.
 */
export function seatFrame(playerFrame: FrameId | undefined, boardDefault: FrameId): Frame {
	return frameById(playerFrame) ?? frameById(boardDefault) ?? (frameById(DEFAULT_FRAME) as Frame);
}
