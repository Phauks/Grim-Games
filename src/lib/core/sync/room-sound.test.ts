import { describe, expect, it } from 'vitest';
import { parseTownSound, TOWN_SOUND_MAX } from './room-sound.ts';

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
