import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_LOOKS, parseBoardLooks } from './board-looks.svelte.ts';

describe('board looks', () => {
	it('keeps valid values and drops the rest', () => {
		expect(parseBoardLooks(null)).toEqual(DEFAULT_BOARD_LOOKS);
		expect(
			parseBoardLooks({
				vignette: false,
				vignetteStrength: 3,
				logo: false,
				logoOpacity: 0,
				rulesAt: 'edge',
				rulesGrouped: true,
				nameSize: 9,
				nameOffset: 1,
				reminders: 'free',
				usedGhostVote: 'struck',
				defaultFrame: 'laurel',
				holdLights: 'seat',
				holdMoves: true,
				// Every reminder is always on the board now (Trevor, 2026-10-23).
				reminderStacks: true,
				// A dragged reminder no longer names its source (Trevor, 2026-10-24).
				dragSource: 'bank',
				// The script's name is only in the lower left corner now (Trevor, 2026-10-18).
				titleAt: 'corner'
			})
		).toEqual({
			vignette: false,
			vignetteStrength: 1,
			logo: false,
			logoOpacity: 0.05,
			rulesAt: 'edge',
			rulesGrouped: true,
			nameSize: 1.6,
			nameOffset: 0.3,
			reminders: 'free',
			usedGhostVote: 'struck',
			defaultFrame: 'laurel',
			holdLights: 'seat',
			holdMoves: true
		});
		expect(
			parseBoardLooks({
				vignetteStrength: 'x',
				logoOpacity: 'x',
				rulesAt: 'top',
				nameSize: 'big',
				nameOffset: -1,
				reminders: 'x',
				usedGhostVote: 'x',
				defaultFrame: 'gilded',
				dragSource: 'x',
				holdLights: 'x',
				holdMoves: 'yes',
				reminderStacks: 'yes',
				titleAt: 'x'
			})
		).toEqual(DEFAULT_BOARD_LOOKS);
		// Saved before grouping was its own choice.
		expect(parseBoardLooks({ rulesAt: 'corner' })).toMatchObject({
			rulesAt: 'edge',
			rulesGrouped: true
		});
	});
});
