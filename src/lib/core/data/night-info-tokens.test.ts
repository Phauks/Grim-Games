/**
 * The info tokens each character's night text names, so its night step has them ready
 * (Trevor, 2026-10-19: the Snake Charmer's step lacked "You are"). Reads the committed TPI
 * data (static/data/roles.json) and our reviewed night text.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nightTextFor } from '#lib/core/rules/night-text.ts';
import { loadGameData } from './game-data.ts';
import { infoTokensNamedIn } from './info-tokens.ts';

const dataDir = new URL('../../../../static/data/', import.meta.url);
const readJson = (file: string): unknown =>
	JSON.parse(readFileSync(new URL(file, dataDir), 'utf8'));
const data = loadGameData({
	roles: readJson('roles.json'),
	jinxes: readJson('jinxes.json'),
	nightsheet: readJson('nightsheet.json')
});

const NIGHTS = ['first', 'other'] as const;
const texts = data.characters.flatMap((character) =>
	NIGHTS.flatMap((night) => {
		const text = nightTextFor(character, night)?.text;
		return text ? [{ character, night, text }] : [];
	})
);
const named = (id: string, night: 'first' | 'other' = 'other') =>
	infoTokensNamedIn(texts.find((t) => t.character.id === id && t.night === night)?.text).map(
		(token) => token.id
	);

describe('info tokens named in night text', () => {
	it('finds the Snake Charmer\'s "You are"', () => {
		// https://wiki.bloodontheclocktower.com/Snake_Charmer: the swapped players learn their
		// new character and alignment.
		expect(named('snakecharmer')).toEqual(['you-are']);
		expect(named('snakecharmer', 'first')).toEqual(['you-are']);
	});

	it('finds every card a step names, once each, in order', () => {
		expect(named('poppygrower')).toEqual(['this-is-the-demon', 'these-are-your-minions']);
		expect(named('barber')).toEqual(['selected-you', 'you-are']);
		expect(named('king', 'first')).toEqual(['this-player-is']);
		expect(named('washerwoman', 'first')).toEqual([]);
	});

	it('leaves no token in any night text unaccounted for', () => {
		// Every *WORD* is the character's own reminder, the death marker or an info token. A
		// new card in TPI's text that we don't have fails here, so no step silently lacks it.
		const unknown = texts.flatMap(({ character, night, text }) => {
			const reminders = [...character.reminders, ...character.remindersGlobal].map((r) =>
				r.toLowerCase()
			);
			const cards = infoTokensNamedIn(text).map((t) => t.text.toLowerCase());
			return [...text.matchAll(/\*([^*]+)\*/g)]
				.map((m) => m[1].toLowerCase())
				.filter(
					(word) =>
						word !== 'dead' &&
						!reminders.includes(word) &&
						!cards.some((card) => card.replace(/[?.]$/, '') === word.replace(/[?.]$/, ''))
				)
				.map((word) => `${character.id}:${night}: ${word}`);
		});
		expect(unknown).toEqual([]);
	});
});
