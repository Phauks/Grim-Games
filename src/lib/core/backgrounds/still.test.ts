import { describe, expect, it } from 'vitest';
import {
	STILL_BACKGROUNDS,
	STILL_IDS,
	parseStill,
	stillCss,
	stillDefaults,
	stillPreset,
	stillPresetOf
} from './still.ts';

describe('still backgrounds (M72)', () => {
	it('has the four Trevor kept: Felt, Parchment, Stone and Velvet', () => {
		expect(STILL_IDS).toEqual(['felt', 'parchment', 'stone', 'velvet']);
	});

	it('gives every preset only settings its background has, and it survives the clean-up', () => {
		for (const id of STILL_IDS) {
			const bg = STILL_BACKGROUNDS[id];
			const ids = new Set(bg.params.map((p) => p.id));
			for (const [name, preset] of Object.entries(bg.presets)) {
				for (const key of Object.keys(preset)) expect(ids, `${id} ${name} ${key}`).toContain(key);
				const full = stillPreset(id, name);
				expect(parseStill({ id, params: full })?.params, `${id} ${name}`).toEqual(full);
				expect(stillPresetOf(id, full)).toBe(name);
			}
		}
	});

	it('reads a choice saved before settings, and drops removed ones', () => {
		expect(parseStill({ id: 'felt' })).toEqual({ id: 'felt', params: stillDefaults('felt') });
		expect(parseStill({ id: 'wood' })).toBeUndefined();
		expect(parseStill({ id: 'night' })).toBeUndefined();
		expect(parseStill({ id: 'stone', params: { base: 'red', texture: 9 } })?.params).toEqual({
			...stillDefaults('stone'),
			texture: 2
		});
	});

	it('draws its colour under the texture, and no texture at zero', () => {
		const css = stillCss({ id: 'stone', params: stillPreset('stone', 'Slate') });
		expect(css.endsWith('#283239')).toBe(true);
		expect(css).toContain('feTurbulence');
		const flat = stillCss({ id: 'felt', params: { ...stillDefaults('felt'), texture: 0 } });
		expect(flat).toContain(encodeURIComponent('0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 0'));
	});
});
