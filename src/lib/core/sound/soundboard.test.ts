import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	BOARD_SOUNDS,
	DEFAULT_ACTION_SOUNDS,
	SOUND_ACTIONS,
	SOUND_OUTPUTS,
	hearsSound,
	parseSoundOutput,
	actionTaken,
	boardSound,
	boardSoundUrl,
	parseActionSounds,
	padId,
	padName,
	padSounds,
	parsePads,
	parseSoundMixes,
	soundMix,
	type ActionState,
	type SoundPad
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

	it('give every action a default that exists', () => {
		for (const action of SOUND_ACTIONS)
			expect(boardSound(DEFAULT_ACTION_SOUNDS[action])).toBeDefined();
	});
});

describe('parseActionSounds', () => {
	it('keeps known sounds and none, and defaults anything else', () => {
		expect(
			parseActionSounds({ dusk: 'none', dawn: 'hand-bell', execution: 'gone', gameEnd: 3 })
		).toEqual({
			dusk: 'none',
			dawn: 'hand-bell',
			execution: DEFAULT_ACTION_SOUNDS.execution,
			gameEnd: DEFAULT_ACTION_SOUNDS.gameEnd
		});
		expect(parseActionSounds(undefined)).toEqual(DEFAULT_ACTION_SOUNDS);
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

describe('parseSoundMixes', () => {
	it("keeps a known sound's changed volume and loop", () => {
		expect(parseSoundMixes({ 'hand-bell': { volume: 0.4, loop: true } })).toEqual({
			'hand-bell': { volume: 0.4, loop: true }
		});
	});

	it('clamps the volume and drops unknown sounds, defaults and junk', () => {
		expect(
			parseSoundMixes({
				'hand-bell': { volume: 3 },
				gone: { volume: 0.5 },
				heartbeat: { volume: 1, loop: false },
				gallows: 'loud'
			})
		).toEqual({});
		expect(parseSoundMixes({ heartbeat: { volume: -1, loop: true } })).toEqual({
			heartbeat: { volume: 0, loop: true }
		});
		expect(parseSoundMixes(null)).toEqual({});
	});

	it('gives a sound never changed the default mix', () => {
		expect(soundMix({}, 'gallows')).toEqual({ volume: 1, loop: false });
	});
});

describe('parsePads', () => {
	it('gives a device that never chose every sound, in order', () => {
		expect(parsePads(undefined).map(padId)).toEqual(BOARD_SOUNDS.map((sound) => sound.id));
	});

	it('keeps the sounds and mixes placed, in their order', () => {
		const pads = [
			{ mix: 'mix-1', name: 'Stormy night', sounds: ['heartbeat', 'village-bell'] },
			{ sound: 'gallows' }
		];
		expect(parsePads(pads)).toEqual(pads);
		expect(padName(pads[0] as SoundPad)).toBe('Stormy night');
		expect(padName({ sound: 'gallows' })).toBe('Gallows trap');
		expect(padSounds({ sound: 'gallows' })).toEqual(['gallows']);
	});

	it('drops unknown sounds, repeats, empty mixes and junk', () => {
		expect(
			parsePads([
				{ sound: 'gone' },
				{ sound: 'gallows' },
				{ sound: 'gallows' },
				{ mix: 'mix-1', name: '  ', sounds: ['gallows'] },
				{ mix: 'mix-2', name: 'Nothing', sounds: ['gone'] },
				{ mix: 'mix-3', name: 'Twice', sounds: ['heartbeat', 'heartbeat', 4] },
				'bell',
				null
			])
		).toEqual([{ sound: 'gallows' }, { mix: 'mix-3', name: 'Twice', sounds: ['heartbeat'] }]);
	});

	it('keeps an empty soundboard empty', () => {
		expect(parsePads([])).toEqual([]);
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

	it('moves an older build’s choice off the Storyteller’s device', () => {
		expect(parseSoundOutput('device')).toBeUndefined();
		expect(parseSoundOutput('both')).toBe('town');
		expect(parseSoundOutput('phones')).toBe('phones');
		expect(parseSoundOutput(7)).toBeUndefined();
	});
});
