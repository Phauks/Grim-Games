import { describe, expect, it } from 'vitest';
import {
	DEFAULT_FRAME,
	FACE_RADIUS,
	FRAMES,
	frameById,
	isFrameUnlocked,
	parseFrameId,
	seatFrame,
	unlockedFrames,
	type Frame
} from './frames.ts';

describe('frames', () => {
	it('keeps all eight styles, with unique ids, none first', () => {
		expect(FRAMES.map((frame) => frame.id)).toEqual([
			'none',
			'ring',
			'double-gold',
			'clock',
			'scalloped',
			'vines',
			'candle',
			'laurel'
		]);
		expect(FRAMES[0].drawing).toEqual([]);
		expect(DEFAULT_FRAME).toBe('none');
	});

	it('unlocks every frame for now (Trevor, 2026-10-22)', () => {
		expect(unlockedFrames()).toHaveLength(FRAMES.length);
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
		expect(parseFrameId('laurel')).toBe('laurel');
		expect(parseFrameId('gilded')).toBeUndefined();
		expect(parseFrameId(3)).toBeUndefined();
		expect(frameById(undefined)).toBeUndefined();
	});

	it("shows the player's own frame, else the board's default", () => {
		expect(seatFrame('vines', 'clock').id).toBe('vines');
		expect(seatFrame(undefined, 'clock').id).toBe('clock');
		expect(seatFrame('gone', 'clock').id).toBe('clock');
		expect(seatFrame(undefined, 'gone').id).toBe('none');
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
