/**
 * Night text markup from TPI's roles.json, drawn as tokens. Characters cited:
 * - https://wiki.bloodontheclocktower.com/Witch (Cursed)
 * - https://wiki.bloodontheclocktower.com/Innkeeper (Safe, Safe, Drunk)
 * - https://wiki.bloodontheclocktower.com/Investigator (Minion, Wrong)
 * - https://wiki.bloodontheclocktower.com/Exorcist (info token)
 */
import { describe, expect, it } from 'vitest';
import { committedCharacter, committedGameData } from '#lib/core/testing/committed-data.ts';
import { nightTextPlain, nightTextSegments } from './night-text.ts';

const plain = (id: string, night: 'first' | 'other' = 'other') => {
	const c = committedCharacter(id);
	const text = night === 'first' ? c.firstNightReminder! : c.otherNightReminder!;
	return nightTextPlain(nightTextSegments(text, c));
};

describe('nightTextSegments', () => {
	it('names the token when the character has only one kind', () => {
		expect(plain('witch')).toBe('The Witch chooses a player. [Cursed]');
	});

	it('names each placeholder in data order when they match the token count', () => {
		expect(plain('innkeeper')).toBe('The Innkeeper chooses 2 players. [Safe] [Safe] [Drunk]');
	});

	it('draws *WORD* as the character’s own token, or as an info token', () => {
		expect(plain('investigator', 'first')).toContain(
			'Point to both the [Minion] and [Wrong] players.'
		);
		expect(plain('exorcist')).toContain(
			'Show the «This character selected you» & Exorcist tokens.'
		);
	});

	it('leaves an unclear placeholder generic, listing the options', () => {
		const segments = nightTextSegments('Do it. :reminder:', {
			reminders: ['Grandchild', 'Dead'],
			remindersGlobal: []
		});
		expect(segments).toEqual([
			{ kind: 'text', text: 'Do it. ' },
			{ kind: 'reminder', options: ['Grandchild', 'Dead'] }
		]);
	});

	it('leaves no raw markup in any official night text', () => {
		for (const c of committedGameData().characters) {
			for (const text of [c.firstNightReminder, c.otherNightReminder]) {
				if (!text) continue;
				const out = nightTextPlain(nightTextSegments(text, c));
				expect(out, c.id).not.toMatch(/:reminder:|\*/);
			}
		}
	});
});
