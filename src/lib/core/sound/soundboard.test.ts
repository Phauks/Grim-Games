import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	BOARD_SOUNDS,
	DEFAULT_ACTION_SOUNDS,
	SOUND_ACTIONS,
	actionTaken,
	boardSound,
	boardSoundUrl,
	parseActionSounds,
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
