import { describe, expect, it } from 'vitest';
import { parsePublicSound, parseTownSound, TOWN_SOUND_MAX } from './room-sound.ts';

describe('parseTownSound', () => {
	it('keeps a play command, clamping each volume', () => {
		expect(
			parseTownSound({
				command: 'play',
				cut: true,
				sounds: [
					{ id: 'hand-bell', volume: 0.5, loop: true },
					{ id: 'gallows', volume: 7 }
				]
			})
		).toEqual({
			command: 'play',
			cut: true,
			sounds: [
				{ id: 'hand-bell', volume: 0.5, loop: true },
				{ id: 'gallows', volume: 1, loop: false }
			]
		});
	});

	it('caps how many sounds one command plays', () => {
		const sounds = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, volume: 1 }));
		const parsed = parseTownSound({ command: 'play', sounds });
		expect(parsed?.command === 'play' && parsed.sounds).toHaveLength(TOWN_SOUND_MAX);
	});

	it('keeps stop, pause and resume', () => {
		expect(parseTownSound({ command: 'stop' })).toEqual({ command: 'stop' });
		expect(parseTownSound({ command: 'stop', ids: ['gallows', 4] })).toEqual({
			command: 'stop',
			ids: ['gallows']
		});
		expect(parseTownSound({ command: 'pause' })).toEqual({ command: 'pause' });
		expect(parseTownSound({ command: 'resume' })).toEqual({ command: 'resume' });
	});

	it('ignores anything malformed', () => {
		expect(parseTownSound(null)).toBeNull();
		expect(parseTownSound({ command: 'shout' })).toBeNull();
		expect(parseTownSound({ command: 'play', sounds: [{ id: '' }] })).toBeNull();
		expect(parseTownSound({ command: 'stop', ids: 'all' })).toBeNull();
	});
});

// Trevor, 2026-10-30: the Storyteller's device plays nothing, so the public table names the
// day or night recording and the timer's sound for the town and phones to play.
describe('parsePublicSound', () => {
	it('keeps who plays, the recording at a clamped level, and the timer’s sound', () => {
		expect(
			parsePublicSound({
				on: 'phones',
				ambience: { id: 'night-meadow', level: 3 },
				timerSound: 'bell',
				extra: true
			})
		).toEqual({ on: 'phones', ambience: { id: 'night-meadow', level: 1 }, timerSound: 'bell' });
	});

	it('drops a recording the app doesn’t have', () => {
		expect(parsePublicSound({ on: 'all', ambience: { id: 'nowhere', level: 0.5 } })).toEqual({
			on: 'all'
		});
	});

	it('is nothing without devices to play it', () => {
		expect(parsePublicSound({ ambience: { id: 'night-meadow', level: 0.5 } })).toBeUndefined();
		expect(parsePublicSound({ on: 'device' })).toBeUndefined();
		expect(parsePublicSound(null)).toBeUndefined();
	});
});
