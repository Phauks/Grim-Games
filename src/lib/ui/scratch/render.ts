/**
 * Draws scratch pad strokes on a canvas. Each stroke is a chain of quadratic curves through
 * the midpoints of its points, which smooths the jitter of a finger or pen; the width
 * follows the pressure at each point. Erasing cuts through the ink to the paper (the
 * canvas's CSS background), so it works on any theme.
 */
import { strokeWidth, type ScratchColour, type ScratchStroke } from '#lib/core/scratch/scratch.ts';

/** Theme tokens for each ink colour, read when drawing so a theme change recolours ink. */
const COLOUR_TOKENS: Record<ScratchColour, string> = {
	ink: '--on-surface',
	good: '--good',
	evil: '--evil',
	highlight: '--heading'
};

export type InkColours = Record<ScratchColour, string>;

export function inkColours(element: Element): InkColours {
	const style = getComputedStyle(element);
	const read = (token: string) => style.getPropertyValue(token).trim() || 'currentColor';
	return {
		ink: read(COLOUR_TOKENS.ink),
		good: read(COLOUR_TOKENS.good),
		evil: read(COLOUR_TOKENS.evil),
		highlight: read(COLOUR_TOKENS.highlight)
	};
}

function prepare(ctx: CanvasRenderingContext2D, stroke: ScratchStroke, colours: InkColours) {
	ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
	ctx.strokeStyle = colours[stroke.colour];
	ctx.fillStyle = colours[stroke.colour];
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
}

const mid = (a: number, b: number) => (a + b) / 2;

/**
 * Draws the part of a stroke that ends at point `index` (0-based), given the canvas width in
 * canvas pixels. Drawing each index in turn, then `finish`, draws the whole stroke; the
 * live stroke uses the same calls as each point arrives.
 */
export function drawSegment(
	ctx: CanvasRenderingContext2D,
	stroke: ScratchStroke,
	index: number,
	width: number,
	colours: InkColours
) {
	const p = stroke.points;
	prepare(ctx, stroke, colours);
	if (index === 0) {
		// A dot, so a tap leaves a mark.
		const r = (strokeWidth(stroke, p[2]) * width) / 2;
		ctx.beginPath();
		ctx.arc(p[0] * width, p[1] * width, r, 0, Math.PI * 2);
		ctx.fill();
		return;
	}
	const i = index * 3;
	const [x1, y1, p1] = [p[i - 3], p[i - 2], p[i - 1]];
	const [x2, y2] = [p[i], p[i + 1]];
	ctx.lineWidth = strokeWidth(stroke, p1) * width;
	ctx.beginPath();
	if (index === 1) ctx.moveTo(x1 * width, y1 * width);
	else ctx.moveTo(mid(p[i - 6], x1) * width, mid(p[i - 5], y1) * width);
	ctx.quadraticCurveTo(x1 * width, y1 * width, mid(x1, x2) * width, mid(y1, y2) * width);
	ctx.stroke();
}

/** Draws the last half-segment, from the final midpoint to the final point. */
export function finish(
	ctx: CanvasRenderingContext2D,
	stroke: ScratchStroke,
	width: number,
	colours: InkColours
) {
	const p = stroke.points;
	const n = p.length / 3;
	if (n < 2) return;
	const i = (n - 1) * 3;
	prepare(ctx, stroke, colours);
	ctx.lineWidth = strokeWidth(stroke, p[i + 2]) * width;
	ctx.beginPath();
	ctx.moveTo(mid(p[i - 3], p[i]) * width, mid(p[i - 2], p[i + 1]) * width);
	ctx.lineTo(p[i] * width, p[i + 1] * width);
	ctx.stroke();
}

export function drawStroke(
	ctx: CanvasRenderingContext2D,
	stroke: ScratchStroke,
	width: number,
	colours: InkColours
) {
	const n = stroke.points.length / 3;
	for (let index = 0; index < n; index++) drawSegment(ctx, stroke, index, width, colours);
	finish(ctx, stroke, width, colours);
}

/** Clears the canvas and draws every stroke; `width` is the canvas width in its own pixels. */
export function drawAll(
	ctx: CanvasRenderingContext2D,
	strokes: readonly ScratchStroke[],
	width: number,
	colours: InkColours
) {
	ctx.globalCompositeOperation = 'source-over';
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	for (const stroke of strokes) drawStroke(ctx, stroke, width, colours);
	ctx.globalCompositeOperation = 'source-over';
}
