import { describe, expect, it } from 'vitest';
import {
	DEFAULT_FRAME,
	DEFAULT_LAUREL_COLOUR,
	FACE_RADIUS,
	FRAMES,
	frameById,
	isFrameUnlocked,
	laurelFrame,
	laurelFrameId,
	parseFrameId,
	seatFrame,
	unlockedFrames,
	type Frame
} from './frames.ts';

describe('frames', () => {
	it('keeps the seven fixed styles, with unique ids, none first', () => {
		expect(FRAMES.map((frame) => frame.id)).toEqual([
			'none',
			'ring',
			'double-gold',
			'clock',
			'scalloped',
			'vines',
			'candle'
		]);
		expect(FRAMES[0].drawing).toEqual([]);
		expect(DEFAULT_FRAME).toBe('none');
	});

	it('unlocks every frame for now (Trevor, 2026-10-22)', () => {
		// The fixed frames, then one laurel per form (Trevor, 2026-10-27: all of them in beta).
		expect(unlockedFrames()).toHaveLength(FRAMES.length + 6);
		expect(
			unlockedFrames()
				.slice(FRAMES.length)
				.map((frame) => frame.id)
		).toContain('laurel-olive-gold');
		expect(unlockedFrames(undefined, 'demon').at(-1)?.id).toBe('laurel-briar-demon');
		expect(FRAMES.every((frame) => frame.unlock === undefined)).toBe(true);
	});

	it('draws every frame outside the face and inside the token', () => {
		for (const frame of FRAMES) {
			for (const part of frame.drawing) {
				if (part.shape === 'path') {
					const numbers = part.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
					expect(numbers.every((n) => n >= 0 && n <= 100)).toBe(true);
					continue;
				}
				const reach = part.shape === 'circle' ? part.r : Math.max(part.rx, part.ry);
				const centre = Math.hypot(part.cx - 50, part.cy - 50);
				// A shape centred on the middle is a ring round the face.
				const outer = centre < 0.01 ? reach + (part.width ?? 0) / 2 : centre + reach;
				expect(outer, `${frame.id} stays inside the token`).toBeLessThanOrEqual(50.5);
				const inner = centre < 0.01 ? reach - (part.width ?? 0) / 2 : centre - reach;
				expect(inner, `${frame.id} clears the face`).toBeGreaterThanOrEqual(FACE_RADIUS - 0.5);
			}
		}
	});

	it('reads back only ids that name a frame', () => {
		expect(parseFrameId('vines')).toBe('vines');
		expect(parseFrameId('laurel-ivy-minion')).toBe('laurel-ivy-minion');
		// The single Laurel frame from before laurels had forms is the gold Laurel now.
		expect(parseFrameId('laurel')).toBe(laurelFrameId('laurel', DEFAULT_LAUREL_COLOUR));
		expect(parseFrameId('laurel-ivy-pink')).toBeUndefined();
		expect(parseFrameId('laurel-rose-gold')).toBeUndefined();
		expect(parseFrameId('laurel-ivy-gold-x')).toBeUndefined();
		expect(parseFrameId('gilded')).toBeUndefined();
		expect(parseFrameId(3)).toBeUndefined();
		expect(frameById(undefined)).toBeUndefined();
	});

	it("shows the player's own laurel, else none: there is no board default", () => {
		expect(seatFrame('vines').id).toBe('vines');
		expect(seatFrame('laurel-myrtle-silver').id).toBe('laurel-myrtle-silver');
		expect(seatFrame(undefined).id).toBe('none');
		expect(seatFrame('gone').id).toBe('none');
	});

	it('draws each laurel once, with its own smaller face', () => {
		const olive = laurelFrame('olive', 'green');
		expect(laurelFrame('olive', 'green')).toBe(olive);
		expect(olive.laurel).toEqual({ form: 'olive', colour: 'green' });
		expect(olive.faceRadius).toBeLessThan(FACE_RADIUS);
		expect(olive.drawing.length).toBeGreaterThan(0);
	});

	it('has room for an unlock rule (achievements, A1)', () => {
		const earned: Frame = {
			id: 'test',
			name: 'Test',
			drawing: [],
			unlock: { kind: 'gamesPlayed', count: 12 }
		};
		expect(isFrameUnlocked(earned)).toBe(false);
		expect(isFrameUnlocked(earned, { gamesPlayed: 11, accolades: 0 })).toBe(false);
		expect(isFrameUnlocked(earned, { gamesPlayed: 12, accolades: 0 })).toBe(true);
		const praised: Frame = { ...earned, unlock: { kind: 'accolades', count: 3 } };
		expect(isFrameUnlocked(praised, { gamesPlayed: 50, accolades: 3 })).toBe(true);
	});
});
