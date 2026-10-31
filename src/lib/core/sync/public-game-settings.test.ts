import { describe, expect, it } from 'vitest';
import { parsePublicGameSettings } from './public-game-settings.ts';

describe('parsePublicGameSettings', () => {
	it('keeps each readable setting', () => {
		const settings = {
			trackNominations: true,
			timerPerPlayer: 30,
			requireName: false,
			holdToReveal: true,
			slotMachine: false
		};
		expect(parsePublicGameSettings(settings)).toEqual(settings);
	});

	it('leaves out what is malformed or unknown, and nothing at all when none is readable', () => {
		expect(
			parsePublicGameSettings({ trackNominations: 'yes', timerPerPlayer: 30.5, secret: 'x' })
		).toBeUndefined();
		expect(parsePublicGameSettings({ timerPerPlayer: 99999, holdToReveal: true })).toEqual({
			holdToReveal: true
		});
		expect(parsePublicGameSettings(null)).toBeUndefined();
		expect(parsePublicGameSettings('on')).toBeUndefined();
	});
});
