import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import { createGame, dispatch, type EngineContext } from '#lib/core/engine/index.ts';
import { characterLookup } from '#lib/core/model/index.ts';
import { setupReminders, type SetupReminder } from '#lib/core/rules/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { trayItems, traySeats, withoutOffSeat } from './setup-tray.ts';

const data = committedGameData();
const script = toScript(editionScript('tb', data)!);
const characters = characterLookup(data, script);
let n = 0;
const ctx: EngineContext = { characters, newId: () => `id${++n}`, now: () => 0, random: () => 0 };

function suggestion(characterId: string, label: string, extra: Partial<SetupReminder> = {}) {
	return {
		characterId,
		label,
		text: `Put [${label}] on a player`,
		reason: '',
		candidates: [],
		timing: 'setup',
		wiki: '',
		...extra
	} as SetupReminder;
}

// The Washerwoman's setup tokens (https://wiki.bloodontheclocktower.com/Washerwoman):
// one Townsfolk and one Wrong on two players.

describe('setup tray', () => {
	it('keys each copy of the same token apart', () => {
		const items = trayItems([suggestion('x', 'A'), suggestion('x', 'A')]);
		expect(items.map((i) => i.key)).toEqual(['x:A:0', 'x:A:1']);
	});
	it('keeps the second copy of a token once the first is placed', () => {
		// The No Dashii poisons both Townsfolk neighbours, so it has two Poisoned tokens
		// (https://wiki.bloodontheclocktower.com/No_Dashii).
		const snv = toScript(editionScript('snv', data)!);
		const lookup = characterLookup(data, snv);
		const local: EngineContext = { ...ctx, characters: lookup };
		const created = createGame({ type: 'CreateGame', script: snv, playerCount: 5 }, local);
		if (!created.ok) throw new Error();
		let session = created.session;
		const seats = session.game.seating;
		['nodashii', 'clockmaker', 'mutant', 'dreamer', 'savant'].forEach((characterId, i) => {
			const result = dispatch(
				session,
				{ type: 'AssignCharacter', seatId: seats[i], characterId },
				local
			);
			if (!result.ok) throw new Error();
			session = result.session;
		});
		const pending = () =>
			trayItems(setupReminders(session.game, lookup)).filter(
				(i) => i.suggestion.characterId === 'nodashii'
			);
		expect(pending()).toHaveLength(2);
		const placed = dispatch(
			session,
			{
				type: 'AddReminder',
				seatId: seats[1],
				reminder: { characterId: 'nodashii', label: 'Poisoned' }
			},
			local
		);
		if (!placed.ok) throw new Error();
		session = placed.session;
		expect(pending()).toHaveLength(1);
	});
	it('lists the pre-filled seat first, then the other candidates', () => {
		expect(traySeats(suggestion('x', 'A', { seatId: 'b', candidates: ['a', 'b', 'c'] }))).toEqual([
			'b',
			'a',
			'c'
		]);
	});
});

describe('withoutOffSeat', () => {
	// Trevor (2026-10-18): a Noble's Know put down loose leaves the bank like one on a seat.
	it('leaves out one suggestion per matching reminder off the seats', () => {
		const items = trayItems([
			suggestion('noble', 'Know'),
			suggestion('noble', 'Know'),
			suggestion('noble', 'Know'),
			suggestion('chef', 'Chef')
		]);
		const left = withoutOffSeat(items, [{ characterId: 'noble', label: 'Know' }]);
		expect(left.map((i) => i.suggestion.label)).toEqual(['Know', 'Know', 'Chef']);
		expect(withoutOffSeat(items, [{ characterId: 'imp', label: 'Dead' }])).toHaveLength(4);
	});
});
