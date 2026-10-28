import { describe, expect, it } from 'vitest';
import { LAUREL_COLOURS, type LaurelColour } from '#lib/core/achievements/laurel.ts';
import {
	DEFAULT_FRAME,
	FACE_RADIUS,
	FRAME_FORMS,
	FRAME_MOTIONS,
	frameById,
	frameId,
	frameMaskSvg,
	frameOf,
	isFrameUnlocked,
	parseFrameId,
	restyleFrame,
	seatFrame,
	unlockedFrames,
	type Frame
} from './frames.ts';

const colours = Object.keys(LAUREL_COLOURS) as LaurelColour[];

describe('frames', () => {
	it('keeps the six fixed forms first, then a laurel per leaf, with unique ids', () => {
		const ids = FRAME_FORMS.map((form) => form.id);
		expect(ids.slice(0, 6)).toEqual([
			'ring',
			'double-gold',
			'clock',
			'scalloped',
			'vines',
			'candle'
		]);
		expect(ids).toContain('laurel-olive');
		expect(new Set(ids).size).toBe(ids.length);
		expect(DEFAULT_FRAME).toBe('none');
	});

	it('unlocks every frame for now (Trevor, 2026-10-22), None first', () => {
		const all = unlockedFrames();
		expect(all).toHaveLength(FRAME_FORMS.length + 1);
		expect(all[0]).toMatchObject({ id: 'none', drawing: [] });
		// Each form in its own colour until one is picked, then all in that one.
		expect(all.map((frame) => frame.id)).toContain('vines-green');
		expect(unlockedFrames(undefined, 'demon').at(-1)?.id).toBe('laurel-briar-demon');
		expect(unlockedFrames(undefined, 'gold', 'sway')[1].id).toBe('ring-gold~sway');
		expect(FRAME_FORMS.every((form) => form.unlock === undefined)).toBe(true);
	});

	it('draws every form, in every colour, outside the face and inside the token', () => {
		for (const form of FRAME_FORMS.filter((form) => !form.id.startsWith('laurel-'))) {
			for (const colour of colours) {
				const frame = frameOf(form, colour);
				expect(frame.drawing.length).toBeGreaterThan(0);
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
		}
	});

	it('takes any colour on any form, the simple ring too (Trevor, 2026-10-28)', () => {
		const ring = frameById('ring-minion');
		expect(ring).toMatchObject({ form: 'ring', colour: 'minion' });
		expect(ring?.drawing[0].stroke).toBe(LAUREL_COLOURS.minion[0]);
		expect(frameById('ring')?.drawing[0].stroke).toBe('var(--accent)');
		expect(frameById('double-gold-silver')).toMatchObject({
			form: 'double-gold',
			colour: 'silver'
		});
	});

	it('reads back only ids that name a frame, older ids as their form in its own colour', () => {
		expect(parseFrameId('none')).toBe('none');
		expect(parseFrameId('vines')).toBe('vines-green');
		expect(parseFrameId('double-gold')).toBe('double-gold-gold');
		expect(parseFrameId('laurel-ivy-minion')).toBe('laurel-ivy-minion');
		// The single Laurel frame from before laurels had forms is the gold Laurel.
		expect(parseFrameId('laurel')).toBe('laurel-laurel-gold');
		expect(parseFrameId('laurel-olive-gold~sway-shimmer')).toBe('laurel-olive-gold~sway-shimmer');
		expect(parseFrameId('laurel-olive-gold~spin')).toBeUndefined();
		expect(parseFrameId('laurel-ivy-pink')).toBeUndefined();
		expect(parseFrameId('laurel-rose-gold')).toBeUndefined();
		expect(parseFrameId('laurel-ivy-gold-x')).toBeUndefined();
		expect(parseFrameId('gilded')).toBeUndefined();
		expect(parseFrameId(3)).toBeUndefined();
		expect(frameById(undefined)).toBeUndefined();
	});

	it('moves only when asked, and keeps its look when the motion changes', () => {
		expect(FRAME_MOTIONS[0]).toBe('none');
		const still = frameById('laurel-myrtle-silver') as Frame;
		expect(still.motion).toBeUndefined();
		const swaying = restyleFrame(still, { motion: 'sway' });
		expect(swaying).toMatchObject({ id: 'laurel-myrtle-silver~sway', motion: 'sway' });
		expect(restyleFrame(swaying, { colour: 'demon' }).id).toBe('laurel-myrtle-demon~sway');
		expect(restyleFrame(swaying, { motion: 'none' })).toBe(still);
		expect(restyleFrame(seatFrame('none'), { colour: 'gold' }).id).toBe('none');
		expect(frameId('vines', 'gold', 'shimmer')).toBe('vines-gold~shimmer');
	});

	it("shows the player's own frame, else none: there is no board default", () => {
		expect(seatFrame('vines-green').id).toBe('vines-green');
		expect(seatFrame('laurel-myrtle-silver').id).toBe('laurel-myrtle-silver');
		expect(seatFrame(undefined).id).toBe('none');
		expect(seatFrame('gone').id).toBe('none');
	});

	it('draws each frame once, laurels with their own smaller face', () => {
		const olive = frameById('laurel-olive-green');
		expect(frameById('laurel-olive-green')).toBe(olive);
		expect(olive?.faceRadius).toBeLessThan(FACE_RADIUS);
	});

	it('makes a mask of the outline in one paint, with no page colours in it', () => {
		const svg = frameMaskSvg(frameById('ring') as Frame);
		expect(svg).toContain('<circle');
		expect(svg).not.toContain('var(');
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
