import { describe, expect, it } from 'vitest';
import {
	DEFAULT_MOVING_MOTION,
	MOVING_BACKGROUNDS,
	MOVING_IDS,
	formatParam,
	movingDefaults,
	movingPreset,
	movingRun,
	parseMoving,
	parseMovingMotion,
	presetOf,
	type RangeParam
} from './moving.ts';

describe('moving backgrounds', () => {
	it('has the five backgrounds from the playground', () => {
		expect(MOVING_IDS).toEqual(['vortex', 'fire', 'rain', 'stars', 'yinyang']);
	});

	it('gives every preset only settings its background has, inside their limits', () => {
		for (const id of MOVING_IDS) {
			const bg = MOVING_BACKGROUNDS[id];
			const ids = new Set(bg.params.map((p) => p.id));
			expect(ids.size).toBe(bg.params.length);
			// A setting that waits on a switch names one of this background's own switches.
			for (const p of bg.params)
				if (p.when) expect(bg.params.find((q) => q.id === p.when)?.type, p.id).toBe('toggle');
			for (const [name, preset] of Object.entries(bg.presets)) {
				for (const key of Object.keys(preset)) expect(ids, `${id} ${name} ${key}`).toContain(key);
				// A preset survives the clean-up unchanged, so it never drifts when shared.
				const full = movingPreset(id, name);
				expect(parseMoving({ id, params: full })?.params, `${id} ${name}`).toEqual(full);
			}
		}
	});

	it('names the preset a choice matches, and none once a setting changes', () => {
		expect(presetOf('vortex', movingPreset('vortex', 'Blood'))).toBe('Blood');
		expect(presetOf('vortex', movingDefaults('vortex'))).toBe('Arcane');
		expect(presetOf('vortex', { ...movingDefaults('vortex'), twist: 2 })).toBeUndefined();
	});

	it('cleans up a shared choice: unknown ids, bad values and extra keys', () => {
		expect(parseMoving({ id: 'lava', params: {} })).toBeUndefined();
		expect(parseMoving('vortex')).toBeUndefined();
		const parsed = parseMoving({
			id: 'vortex',
			params: { deep: 'red', arms: '#ABCDEF', count: 99, twist: 0.33, ring: 'yes', extra: 1 }
		});
		expect(parsed?.params.deep).toBe('#07031a');
		expect(parsed?.params.arms).toBe('#abcdef');
		expect(parsed?.params.count).toBe(7);
		expect(parsed?.params.twist).toBe(0.35);
		expect(parsed?.params.ring).toBe(true);
		expect(parsed?.params).not.toHaveProperty('extra');
	});

	it('reads motion settings, falling back to drawing every refresh and holding still', () => {
		expect(parseMovingMotion(undefined)).toEqual(DEFAULT_MOVING_MOTION);
		expect(parseMovingMotion({ fps: '30', reduceMotion: 'gentle', still: true })).toEqual({
			fps: '30',
			reduceMotion: 'gentle',
			still: true
		});
		expect(parseMovingMotion({ fps: 12, reduceMotion: 'fast' })).toEqual(DEFAULT_MOVING_MOTION);
	});

	it('holds still with Reduce motion on, unless told otherwise', () => {
		const rain = { id: 'rain' as const, params: movingDefaults('rain') };
		expect(movingRun(rain, DEFAULT_MOVING_MOTION, true).still).toBe(true);
		expect(movingRun(rain, DEFAULT_MOVING_MOTION, false)).toMatchObject({ still: false, speed: 1 });
		expect(movingRun(rain, { ...DEFAULT_MOVING_MOTION, still: true }, false).still).toBe(true);
		const gentle = movingRun(rain, { ...DEFAULT_MOVING_MOTION, reduceMotion: 'gentle' }, true);
		expect(gentle).toMatchObject({ still: false, speed: 0.35 });
		expect(gentle.params.lightning).toBe(0);
		expect(movingRun(rain, { ...DEFAULT_MOVING_MOTION, reduceMotion: 'ignore' }, true).speed).toBe(
			1
		);
	});

	it('keeps lightning to one flash every few seconds at most', () => {
		// WCAG 2.3.1: no more than three flashes in any second. Each strike is one flash and
		// strikes are at least four seconds apart (Rain.svelte), so the most a minute allows is 15.
		const lightning = MOVING_BACKGROUNDS.rain.params.find(
			(p) => p.id === 'lightning'
		) as RangeParam;
		expect(lightning.max).toBeLessThanOrEqual(15);
	});

	it('writes slider values in words people read', () => {
		const param = (unit: RangeParam['unit']): RangeParam => ({
			id: 'x',
			label: 'X',
			type: 'range',
			value: 0,
			min: 0,
			max: 10,
			step: 1,
			unit
		});
		expect(formatParam(param('percent'), 0.5)).toBe('50%');
		expect(formatParam(param('count'), 3)).toBe('3');
		expect(formatParam(param('perMinute'), 0)).toBe('None');
		expect(formatParam(param('times'), 1.5)).toBe('1.50×');
	});
});
