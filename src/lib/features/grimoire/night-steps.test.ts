import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import { createGame, dispatch, type EngineContext } from '#lib/core/engine/index.ts';
import { characterLookup, type Game } from '#lib/core/model/index.ts';
import type { NightStep } from '#lib/core/rules/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { boardNightSteps, givesNumber, stepHolders } from './night-steps.ts';

const data = committedGameData();
const script = toScript(editionScript('tb', data)!);
const characters = characterLookup(data, script);
let n = 0;
const ctx: EngineContext = { characters, newId: () => `id${++n}`, now: () => 0, random: () => 0 };

function game(assign: string[]): Game {
	let session = createGame({ type: 'CreateGame', script, playerCount: 7 }, ctx);
	if (!session.ok) throw new Error();
	assign.forEach((characterId, i) => {
		if (!session.ok) throw new Error();
		const seatId = session.session.game.seating[i];
		session = dispatch(session.session, { type: 'AssignCharacter', seatId, characterId }, ctx);
	});
	if (!session.ok) throw new Error();
	return session.session.game;
}

const marker = (id: string) => ({ id, kind: 'marker' }) as unknown as NightStep;

describe('stepHolders', () => {
	// https://wiki.bloodontheclocktower.com/Setup : the Minions wake together and learn who
	// the Demon is, then the Demon wakes.
	it('marks every Minion for Minion info and the Demon for Demon info', () => {
		const g = game(['poisoner', 'imp', 'spy', 'empath']);
		expect(stepHolders(g, marker('minioninfo'), characters)).toEqual([g.seating[0], g.seating[2]]);
		expect(stepHolders(g, marker('demoninfo'), characters)).toEqual([g.seating[1]]);
		expect(stepHolders(g, marker('dusk'), characters)).toEqual([]);
	});
});

describe('boardNightSteps', () => {
	// Dusk opens every night (Trevor, 2026-10-16;
	// https://wiki.bloodontheclocktower.com/Night_Order), a Traveller's alignment step after it.
	// Dawn closes every night (Trevor, 2026-10-20), before TPI's after-Dawn announcements.
	it('starts with Dusk and ends with Dawn, on the first and other nights', () => {
		const g = game(['poisoner', 'imp', 'empath', 'thief']);
		for (const night of ['first', 'other'] as const) {
			const steps = boardNightSteps(g, characters, night, data).filter((s) => !s.afterDawn);
			expect(steps[0].id).toBe('dusk');
			expect(steps.at(-1)?.id).toBe('dawn');
			expect(steps.map((s) => s.id)).toContain('traveller-alignment');
		}
	});
});

describe('givesNumber', () => {
	// https://wiki.bloodontheclocktower.com/Empath : learns a number each night.
	// https://wiki.bloodontheclocktower.com/Washerwoman : learns a player and a character, no number.
	it('is the steps whose night text gives a finger signal', () => {
		const steps = boardNightSteps(
			game(['empath', 'chef', 'washerwoman', 'imp']),
			characters,
			'first',
			data
		);
		const ids = steps.filter(givesNumber).map((s) => s.id);
		expect(ids).toContain('empath');
		expect(ids).toContain('chef');
		expect(ids).not.toContain('washerwoman');
		expect(ids).not.toContain('dusk');
	});
});

describe('character change steps', () => {
	// https://wiki.bloodontheclocktower.com/Imp : the Minion who becomes the Imp is woken and
	// shown the Imp token.
	it('wakes the new Imp before Dawn on other nights, marking that player', () => {
		const g = game(['poisoner', 'imp', 'empath']);
		const changes = [{ seatId: g.seating[0], characterId: 'imp' }];
		const other = boardNightSteps(g, characters, 'other', data, changes);
		const step = other.find((s) => s.changed);
		expect(step?.id).toBe(`changed@${g.seating[0]}`);
		expect(other.filter((s) => !s.afterDawn).at(-2)).toBe(step);
		expect(stepHolders(g, step!, characters)).toEqual([g.seating[0]]);
		const first = boardNightSteps(g, characters, 'first', data, changes);
		expect(first.some((s) => s.changed)).toBe(false);
	});
});
