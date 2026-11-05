import { describe, expect, it } from 'vitest';
import { movingDefaults } from '#lib/core/backgrounds/moving.ts';
import { parsePublicLook } from '#lib/core/sync/public-projection.ts';
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

	it("shares the Storyteller's own picture, which the room names once it is uploaded", () => {
		const image = new Blob(['x']);
		expect(lookOf({ kind: 'image', image }, DEFAULT_BOARD_LOOKS).background).toBe('image');
		expect(drawnLook({ background: 'image', image: 'a'.repeat(64) })).toEqual({
			script: false,
			image: 'a'.repeat(64)
		});
		// Not uploaded yet: no background.
		expect(drawnLook({ background: 'image' })).toEqual({ script: false });
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

	it('shares a moving background by its id and settings, cleaned up on arrival (M43)', () => {
		const params = movingDefaults('fire');
		const look = lookOf({ kind: 'moving', id: 'fire', params }, DEFAULT_BOARD_LOOKS);
		expect(look).toMatchObject({ background: 'moving', moving: { id: 'fire', params } });
		const arrived = parsePublicLook(JSON.parse(JSON.stringify(look)));
		expect(drawnLook(arrived)).toMatchObject({ moving: { id: 'fire', params } });
		// A scene this build doesn't know draws no background.
		const unknown = parsePublicLook({ background: 'moving', moving: { id: 'lava', params: {} } });
		expect(drawnLook(unknown)).toEqual({ script: false });
	});

	it('draws no background before the board shares one', () => {
		expect(drawnLook(undefined)).toEqual({ script: false, vignette: 0.55, logo: 0.3 });
	});
});
