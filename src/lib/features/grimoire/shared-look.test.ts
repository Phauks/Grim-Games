import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_LOOKS } from './board-looks.svelte.ts';
import { drawnLook, lookOf } from './shared-look.ts';

describe('the look a board shares', () => {
	it('shares a preset or the script image, and the vignette and logo while they are on', () => {
		expect(lookOf({ kind: 'preset', id: 'felt' }, DEFAULT_BOARD_LOOKS)).toEqual({
			background: 'felt',
			vignette: 0.55,
			logo: 0.3
		});
		expect(
			lookOf({ kind: 'script' }, { ...DEFAULT_BOARD_LOOKS, vignette: false, logo: false })
		).toEqual({ background: 'script' });
	});

	it("keeps the Storyteller's own picture on their device", () => {
		const image = new Blob(['x']);
		expect(lookOf({ kind: 'image', image }, DEFAULT_BOARD_LOOKS).background).toBeUndefined();
	});

	it('draws what was shared, the same on every device', () => {
		expect(drawnLook({ background: 'night', vignette: 0.2 })).toEqual({
			preset: 'night',
			script: false,
			vignette: 0.2
		});
		expect(drawnLook({ background: 'script' })).toEqual({ script: true });
		// An id this build doesn't know draws no background.
		expect(drawnLook({ background: 'marble' })).toEqual({ script: false });
	});

	it('draws no background before the board shares one', () => {
		expect(drawnLook(undefined)).toEqual({ script: false, vignette: 0.55, logo: 0.3 });
	});
});
