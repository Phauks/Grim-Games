import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	BOARD_SOUNDS,
	DEFAULT_MOMENT_SOUNDS,
	GAME_SOUNDS,
	MADE_SOUNDS,
	SOUND_MOMENTS,
	SOUND_OUTPUTS,
	hearsAmbience,
	parseStorytellerSounds,
	hearsSound,
	parseSoundOutput,
	actionTaken,
	boardSound,
	boardSoundUrl,
	isGameSound,
	parseMomentSounds,
	soundLoops,
	type ActionState
} from './soundboard.ts';

describe('the soundboard sounds', () => {
	it('are all in static/sounds/board, with nothing unused there', () => {
		expect(new Set(readdirSync('static/sounds/board'))).toEqual(
			new Set(BOARD_SOUNDS.map((sound) => `${sound.id}.mp3`))
		);
	});

	it('each have their own id and name and a page to credit', () => {
		expect(new Set(BOARD_SOUNDS.map((sound) => sound.id)).size).toBe(BOARD_SOUNDS.length);
		expect(new Set(BOARD_SOUNDS.map((sound) => sound.name)).size).toBe(BOARD_SOUNDS.length);
		for (const sound of BOARD_SOUNDS) expect(sound.page).toMatch(/^https:\/\//);
	});

	it('have a URL under the board sound path', () => {
		expect(boardSoundUrl(boardSound('gallows')!)).toBe('/sounds/board/gallows.mp3');
	});

	it('are one list with the made sounds, each id once', () => {
		expect(GAME_SOUNDS.slice(0, MADE_SOUNDS.length)).toEqual([...MADE_SOUNDS]);
		expect(new Set(GAME_SOUNDS).size).toBe(GAME_SOUNDS.length);
		for (const id of GAME_SOUNDS) expect(isGameSound(id)).toBe(true);
		expect(isGameSound('gone')).toBe(false);
		expect(isGameSound('none')).toBe(false);
	});

	it('loop only the heartbeats', () => {
		expect(GAME_SOUNDS.filter(soundLoops)).toEqual(['heartbeat', 'fast-heartbeat']);
	});

	// Trevor, 2026-11-19: game moments are on by default.
	it('give every moment a default sound that exists', () => {
		for (const moment of SOUND_MOMENTS)
			expect(isGameSound(DEFAULT_MOMENT_SOUNDS[moment])).toBe(true);
	});
});

describe('parseMomentSounds', () => {
	it('keeps known sounds, made or recorded, and none, and defaults anything else', () => {
		expect(
			parseMomentSounds({
				dusk: 'none',
				dawn: 'hand-bell',
				execution: 'gone',
				timeUp: 'buzzer',
				townCall: 3
			})
		).toEqual({
			dusk: 'none',
			dawn: 'hand-bell',
			execution: DEFAULT_MOMENT_SOUNDS.execution,
			timeUp: 'buzzer',
			townCall: DEFAULT_MOMENT_SOUNDS.townCall,
			gameEnd: DEFAULT_MOMENT_SOUNDS.gameEnd
		});
		expect(parseMomentSounds(undefined)).toEqual(DEFAULT_MOMENT_SOUNDS);
	});
});

describe('actionTaken', () => {
	const at = (change: Partial<ActionState> = {}): ActionState => ({
		phase: 'day',
		executions: 0,
		ended: false,
		...change
	});

	it('hears Start game and End day as Dusk, and the night ending as Dawn', () => {
		expect(actionTaken(at({ phase: 'setup' }), at({ phase: 'night' }))).toBe('dusk');
		expect(actionTaken(at(), at({ phase: 'night' }))).toBe('dusk');
		expect(actionTaken(at({ phase: 'night' }), at())).toBe('dawn');
	});

	it('hears an execution, but not one undone', () => {
		expect(actionTaken(at(), at({ executions: 1 }))).toBe('execution');
		expect(actionTaken(at({ executions: 1 }), at())).toBeUndefined();
	});

	it('hears the game ending once, and nothing while it stays ended or is reopened', () => {
		expect(actionTaken(at({ executions: 1 }), at({ executions: 1, ended: true }))).toBe('gameEnd');
		expect(actionTaken(at({ ended: true }), at({ ended: true, phase: 'night' }))).toBeUndefined();
		expect(actionTaken(at({ ended: true }), at())).toBeUndefined();
	});

	it('plays nothing when nothing changed, or for going back to Setup', () => {
		expect(actionTaken(at(), at())).toBeUndefined();
		expect(actionTaken(at({ phase: 'night' }), at({ phase: 'setup' }))).toBeUndefined();
	});
});

// Trevor, 2026-10-30: "Do not play audio from storytellers device ... Only play remote on
// other devices". Play on offers no choice that sounds on the Storyteller's device.
describe('Play on', () => {
	it('names only the room’s other devices', () => {
		expect(SOUND_OUTPUTS).toEqual(['all', 'phones', 'town']);
		expect(hearsSound('all', 'town')).toBe(true);
		expect(hearsSound('all', 'phones')).toBe(true);
		expect(hearsSound('town', 'phones')).toBe(false);
		expect(hearsSound('phones', 'town')).toBe(false);
	});

	it('plays day and night sound on one kind of device, so phones never echo each other', () => {
		expect(hearsAmbience('all', 'town')).toBe(true);
		expect(hearsAmbience('all', 'phones')).toBe(false);
		expect(hearsAmbience('town', 'town')).toBe(true);
		expect(hearsAmbience('town', 'phones')).toBe(false);
		expect(hearsAmbience('phones', 'phones')).toBe(true);
		expect(hearsAmbience('phones', 'town')).toBe(false);
	});

	it('moves an older build’s choice off the Storyteller’s device', () => {
		expect(parseSoundOutput('device')).toBeUndefined();
		expect(parseSoundOutput('both')).toBe('town');
		expect(parseSoundOutput('phones')).toBe('phones');
		expect(parseSoundOutput(7)).toBeUndefined();
	});
});

describe('a player’s answer to the Storyteller’s sounds', () => {
	it('keeps on or off, and reads anything else as not asked yet', () => {
		expect(parseStorytellerSounds('on')).toBe('on');
		expect(parseStorytellerSounds('off')).toBe('off');
		expect(parseStorytellerSounds(undefined)).toBeUndefined();
		expect(parseStorytellerSounds('yes')).toBeUndefined();
	});
});
