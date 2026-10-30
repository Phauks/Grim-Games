import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES } from '#lib/ui/preferences.ts';
import { asPreferences, parseGameSettings, settingsFrom } from './game-settings.ts';

const defaults = settingsFrom(DEFAULT_PREFERENCES);

describe('settings for one game', () => {
	it('start from Settings', () => {
		const prefs = {
			...DEFAULT_PREFERENCES,
			assistance: { ...DEFAULT_PREFERENCES.assistance, trackNominations: true },
			holdToReveal: true
		};
		expect(settingsFrom(prefs)).toMatchObject({
			trackNominations: true,
			holdToReveal: true
		});
	});

	it('read a stored game as stored', () => {
		const stored = {
			...defaults,
			trackNominations: true,
			setupForPlayers: 'town' as const,
			timerPerPlayer: 45
		};
		expect(parseGameSettings(stored, defaults)).toEqual(stored);
	});

	it('take Settings for a game with no record, as it always played', () => {
		expect(parseGameSettings(undefined, defaults)).toEqual(defaults);
	});

	it('take Settings for each missing or unreadable value alone', () => {
		const read = parseGameSettings(
			{
				trackNominations: true,
				setupForPlayers: 'noon',
				timerPerPlayer: 9999,
				slotMachine: 'yes'
			},
			defaults
		);
		expect(read).toEqual({ ...defaults, trackNominations: true });
	});

	it('store nomination tracking where Settings keeps it, with the other help switches', () => {
		const change = asPreferences(
			{ trackNominations: true, requireName: true },
			DEFAULT_PREFERENCES
		);
		expect(change.requireName).toBe(true);
		expect(change.assistance).toEqual({
			...DEFAULT_PREFERENCES.assistance,
			trackNominations: true
		});
		expect(asPreferences({ requireName: false }, DEFAULT_PREFERENCES)).not.toHaveProperty(
			'assistance'
		);
	});
});
