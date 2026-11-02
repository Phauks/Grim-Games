/**
 * Shapes the CSS scenes share (moving backgrounds, plan L113): a fixed scatter, so every
 * render and every screenshot is the same, and silhouettes drawn as SVG paths.
 */

/** A number from 0 to 1, always the same for the same `i` and `salt`. */
export function rand(i: number, salt: number): number {
	const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
	return x - Math.floor(x);
}

export const range = <T>(n: number, f: (i: number) => T): T[] =>
	Array.from({ length: n }, (_, i) => f(i));

/** One decimal place, enough for a path in a 200-wide view box. */
export const f1 = (n: number) => n.toFixed(1);

export interface ScenePoint {
	left: number;
	top: number;
	size: number;
	dur: number;
	delay: number;
}

/** Twinkling points (stars, motes) spread over the given height range, in percent. */
export function points(
	n: number,
	salt: number,
	size: [number, number],
	dur: [number, number],
	top: [number, number] = [0, 92]
): ScenePoint[] {
	return range(n, (i) => ({
		left: rand(i, salt) * 100,
		top: top[0] + rand(i, salt + 1) * (top[1] - top[0]),
		size: size[0] + rand(i, salt + 2) * (size[1] - size[0]),
		dur: dur[0] + rand(i, salt + 3) * (dur[1] - dur[0]),
		delay: -rand(i, salt + 4) * dur[1]
	}));
}

/** The height of a rolling ridge at `x`. */
export function ridgeY(x: number, base: number, amp: number, salt: number): number {
	return (
		base -
		amp *
			(Math.sin(x * 0.05 + salt) * 0.6 +
				Math.sin(x * 0.13 + salt * 2.3) * 0.3 +
				Math.sin(x * 0.31 + salt * 1.7) * 0.1)
	);
}

/** A ridge silhouette in a `w` by `h` view box, filled down to the bottom. */
export function ridge(w: number, h: number, base: number, amp: number, salt: number, steps = 48) {
	let d = `M0 ${h}`;
	for (let s = 0; s <= steps; s++) {
		const x = (s / steps) * w;
		d += ` L${f1(x)} ${f1(ridgeY(x, base, amp, salt))}`;
	}
	return `${d} L${w} ${h} Z`;
}

/** A three-tier pine standing at (x, b), h tall. */
function pine(x: number, b: number, h: number) {
	let d = '';
	for (let j = 0; j < 3; j++) {
		const top = b - h + j * h * 0.22;
		const bottom = b - h * 0.45 + j * h * 0.22;
		const w = h * 0.32 * (0.55 + j * 0.25);
		d += `M${f1(x - w)} ${f1(bottom)} L${f1(x)} ${f1(top)} L${f1(x + w)} ${f1(bottom)} Z `;
	}
	return d;
}

/** A forest edge: `n` pines along a ridge. */
export function treeline(w: number, h: number, base: number, amp: number, salt: number, n: number) {
	let d = ridge(w, h, base, amp, salt);
	for (let i = 0; i < n; i++) {
		const x = (i / n) * w + rand(i, salt + 1) * (w / n);
		d += ' ' + pine(x, ridgeY(x, base, amp, salt) + 1, 5 + rand(i, salt + 2) * 9);
	}
	return d;
}
