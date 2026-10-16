import { describe, expect, it } from 'vitest';
import { editionScript, type Script } from '#lib/core/data/index.ts';
import { createGame, dispatch, type Command, type EngineContext } from '#lib/core/engine/index.ts';
import { characterLookup, type CharacterLookup, type Game } from '#lib/core/model/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	charactersReallyInPlay,
	demonBluffsInPlay,
	lunaticInPlay,
	showableBluffSets
} from './bluffs.ts';

const data = committedGameData();

function game(
	edition: 'tb' | 'bmr',
	cast: string[],
	extra: (seats: string[]) => Command[] = () => []
) {
	const loaded = editionScript(edition, data);
	if (!loaded) throw new Error(edition);
	const script: Script = {
		entries: loaded.characters.map((c) => ({ kind: 'official', id: c.id }))
	};
	const characters = characterLookup(data, script);
	let n = 0;
	const ctx: EngineContext = { characters, newId: () => `id${n++}`, now: () => 0, random: () => 0 };
	const created = createGame({ type: 'CreateGame', script, playerCount: cast.length }, ctx);
	if (!created.ok) throw new Error(created.error.message);
	let session = created.session;
	const seats = session.game.seating;
	const commands: Command[] = [
		...cast.map((characterId, i): Command => ({
			type: 'AssignCharacter',
			seatId: seats[i],
			characterId
		})),
		...extra(seats)
	];
	for (const command of commands) {
		const result = dispatch(session, command, ctx);
		if (!result.ok) throw new Error(result.error.message);
		session = result.session;
	}
	return { game: session.game as Game, characters: characters as CharacterLookup };
}

describe('bluffs and characters in play', () => {
	it("leaves the Drunk's believed Townsfolk out of play (wiki: Drunk)", () => {
		const { game: g, characters } = game('tb', ['chef', 'empath', 'imp'], (s) => [
			{
				type: 'AddReminder',
				seatId: s[0],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			}
		]);
		const inPlay = charactersReallyInPlay(g, characters);
		expect(inPlay.has('chef')).toBe(false);
		expect(inPlay.has('drunk')).toBe(true);
		expect(inPlay.has('empath')).toBe(true);
	});

	it('flags Demon bluffs that are now in play, but not the Lunatic set', () => {
		const { game: g, characters } = game('bmr', ['sailor', 'lunatic', 'zombuul'], () => [
			{ type: 'SetBluffs', set: 0, characterIds: ['sailor', 'chambermaid', 'exorcist'] },
			{ type: 'SetBluffs', set: 1, characterIds: ['sailor'] }
		]);
		expect(demonBluffsInPlay(g, characters)).toEqual(['sailor']);
		expect(lunaticInPlay(g, characters)).toBe(true);
	});

	it('has no Lunatic set without a Lunatic', () => {
		const { game: g, characters } = game('tb', ['chef', 'imp']);
		expect(lunaticInPlay(g, characters)).toBe(false);
	});

	it('offers every set with characters, named by position', () => {
		const lunatic = game('bmr', ['sailor', 'lunatic', 'zombuul'], () => [
			{ type: 'SetBluffs', set: 0, characterIds: ['chambermaid', 'exorcist', 'innkeeper'] },
			{ type: 'SetBluffs', set: 1, characterIds: ['sailor'] }
		]);
		expect(showableBluffSets(lunatic.game, lunatic.characters).map((s) => s.label)).toEqual([
			'Demon',
			'Lunatic'
		]);
		const plain = game('tb', ['chef', 'imp'], () => [
			{ type: 'SetBluffs', set: 0, characterIds: ['empath'] }
		]);
		expect(showableBluffSets(plain.game, plain.characters)).toEqual([
			{ set: 0, label: 'Demon', characterIds: ['empath'] }
		]);
		expect(showableBluffSets(game('tb', ['chef', 'imp']).game, plain.characters)).toEqual([]);
		const three = game('tb', ['chef', 'imp'], () => [
			{ type: 'SetBluffs', set: 0, characterIds: ['empath'] },
			{ type: 'SetBluffs', set: 1, characterIds: [] },
			{ type: 'SetBluffs', set: 2, characterIds: ['monk'] }
		]);
		expect(showableBluffSets(three.game, three.characters).map((s) => s.label)).toEqual([
			'Demon',
			'Set 3'
		]);
	});
});
