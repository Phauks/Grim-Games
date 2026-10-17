import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_LOOKS, parseBoardLooks } from './board-looks.svelte.ts';

describe('board looks', () => {
	it('keeps valid values and drops the rest', () => {
		expect(parseBoardLooks(null)).toEqual(DEFAULT_BOARD_LOOKS);
		expect(
			parseBoardLooks({ vignette: false, vignetteStrength: 3, rulesAt: 'edge', nameSize: 9 })
		).toEqual({
			vignette: false,
			vignetteStrength: 1,
			rulesAt: 'edge',
			nameSize: 1.6
		});
		expect(parseBoardLooks({ vignetteStrength: 'x', rulesAt: 'corner', nameSize: 'big' })).toEqual(
			DEFAULT_BOARD_LOOKS
		);
	});
});
