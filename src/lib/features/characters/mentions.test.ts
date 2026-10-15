import { describe, expect, it } from 'vitest';
import { mentionSegments, type NamedCharacter } from './mentions.ts';

const characters: NamedCharacter[] = [
	{ id: 'witch', name: 'Witch' },
	{ id: 'drunk', name: 'Drunk' },
	{ id: 'scarletwoman', name: 'Scarlet Woman' },
	{ id: 'villageidiot', name: 'Village Idiot' },
	{ id: 'imp', name: 'Imp' }
];

describe('mentionSegments', () => {
	it('marks character names and keeps the text between them', () => {
		expect(mentionSegments('The Witch chooses a player.', characters)).toEqual([
			{ kind: 'text', text: 'The ' },
			{ kind: 'character', characterId: 'witch', text: 'Witch' },
			{ kind: 'text', text: ' chooses a player.' }
		]);
	});

	it('leaves the lower-case state word alone but marks the Drunk', () => {
		const segments = mentionSegments('1 of the extras is drunk. The Drunk thinks', characters);
		expect(segments.filter((s) => s.kind === 'character')).toEqual([
			{ kind: 'character', characterId: 'drunk', text: 'Drunk' }
		]);
	});

	it('leaves a reminder token name alone', () => {
		expect(
			mentionSegments('a Poisoned or Drunk reminder is on them', characters).map((s) => s.kind)
		).toEqual(['text']);
	});

	it('prefers the longest name and counts plurals', () => {
		const segments = mentionSegments('Wake the Village Idiots. The Scarlet Woman', characters);
		expect(segments.filter((s) => s.kind === 'character').map((s) => s.text)).toEqual([
			'Village Idiots',
			'Scarlet Woman'
		]);
	});

	it('does not match a name inside another word', () => {
		expect(mentionSegments('Important impish Imps', characters).map((s) => s.kind)).toEqual([
			'text',
			'character'
		]);
	});
});
