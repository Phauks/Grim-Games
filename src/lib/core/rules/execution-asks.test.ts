/**
 * When the day's Execution needs its sheet (Trevor, 2026-11-06, option B): only when executing
 * the player has a choice to make, such as a save or a player executed instead
 * (https://wiki.bloodontheclocktower.com/Sailor, /Scapegoat). Otherwise the board's Confirm is
 * enough.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId, Script } from '#lib/core/data/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { executionAsks } from './execution-asks.ts';

const scriptOf = (ids: CharacterId[]): Script => ({
	meta: { name: 'Asks' },
	entries: ids.map((id) => ({ kind: 'official' as const, id }))
});

describe('executionAsks', () => {
	it('asks nothing more on a script with no save or execution ability', () => {
		const cast: CharacterId[] = ['chef', 'empath', 'monk', 'poisoner', 'imp'];
		const s = scenario(cast, { script: scriptOf(cast) });
		expect(executionAsks(s.game, s.seat('chef'), s.characters)).toBe(false);
	});

	it('asks Saved by while a Sailor is in play, not while it is only on the script', () => {
		// Wiki: "Each night, choose an alive player: either you or they are drunk until dusk. You can't die."
		const cast: CharacterId[] = ['chef', 'empath', 'monk', 'poisoner', 'imp'];
		const onScript = scenario(cast, { script: scriptOf([...cast, 'sailor']) });
		expect(executionAsks(onScript.game, onScript.seat('chef'), onScript.characters)).toBe(false);
		const withSailor: CharacterId[] = ['sailor', 'empath', 'monk', 'poisoner', 'imp'];
		const inPlay = scenario(withSailor, { script: scriptOf(withSailor) });
		expect(executionAsks(inPlay.game, inPlay.seat('empath'), inPlay.characters)).toBe(true);
	});

	it('asks while a Scapegoat might be executed instead', () => {
		// Wiki: "If a player of your alignment is executed, you might be executed instead."
		const cast: CharacterId[] = ['chef', 'empath', 'scapegoat', 'poisoner', 'imp'];
		const s = scenario(cast, { script: scriptOf(cast) });
		expect(executionAsks(s.game, s.seat('chef'), s.characters)).toBe(true);
	});

	it("asks when the Storyteller's override says the player can't die", () => {
		const cast: CharacterId[] = ['chef', 'empath', 'monk', 'poisoner', 'imp'];
		const s = scenario(cast, { script: scriptOf(cast) }).do((base) => ({
			type: 'SetOverride',
			seatId: base.seat('chef'),
			override: { field: 'canDie', value: false }
		}));
		expect(executionAsks(s.game, s.seat('chef'), s.characters)).toBe(true);
	});
});
