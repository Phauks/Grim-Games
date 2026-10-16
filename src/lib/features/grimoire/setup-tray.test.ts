import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import { createGame, dispatch, type EngineContext } from '#lib/core/engine/index.ts';
import { characterLookup } from '#lib/core/model/index.ts';
import type { SetupReminder } from '#lib/core/rules/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { pendingTray, trayItems, traySeats } from './setup-tray.ts';

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

function game(placed: { characterId: string; label: string }[] = []) {
	let result = createGame({ type: 'CreateGame', script, playerCount: 5 }, ctx);
	if (!result.ok) throw new Error();
	for (const reminder of placed) {
		result = dispatch(
			result.session,
			{ type: 'AddReminder', seatId: result.session.game.seating[0], reminder },
			ctx
		);
		if (!result.ok) throw new Error();
	}
	return result.session.game;
}

// The Washerwoman's setup tokens (https://wiki.bloodontheclocktower.com/Washerwoman):
// one Townsfolk and one Wrong on two players.
const washer = [suggestion('washerwoman', 'Townsfolk'), suggestion('washerwoman', 'Wrong')];

describe('setup tray', () => {
	it('keys each copy of the same token apart', () => {
		const items = trayItems([suggestion('x', 'A'), suggestion('x', 'A')]);
		expect(items.map((i) => i.key)).toEqual(['x:A:0', 'x:A:1']);
	});
	it('drops suggestions already placed on the board, however they got there', () => {
		const items = trayItems(washer);
		const pending = pendingTray(items, game([{ characterId: 'washerwoman', label: 'Wrong' }]), []);
		expect(pending.map((i) => i.suggestion.label)).toEqual(['Townsfolk']);
	});
	it('drops dismissed suggestions', () => {
		const items = trayItems(washer);
		expect(pendingTray(items, game(), ['washerwoman:Townsfolk:0']).length).toBe(1);
	});
	it('lists the pre-filled seat first, then the other candidates', () => {
		expect(traySeats(suggestion('x', 'A', { seatId: 'b', candidates: ['a', 'b', 'c'] }))).toEqual([
			'b',
			'a',
			'c'
		]);
	});
});
