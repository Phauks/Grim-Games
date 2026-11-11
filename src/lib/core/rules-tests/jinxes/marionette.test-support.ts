/**
 * Shared set-up for the Marionette's jinxes (each page's Related Jinxes on the wiki,
 * https://wiki.bloodontheclocktower.com/Marionette#Related_Jinxes): the Marionette who thinks
 * they are a good character, that character's token on their seat with Is The Marionette.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import { gainedSetupAbilities } from '#lib/core/rules/abilities/gained-abilities.ts';
import { analyseSetup } from '#lib/core/rules/setup/setup.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { scriptOf } from './summoner.test-support.ts';

export { scriptOf };

/**
 * Seat 0 is the evil Marionette who thinks they are `thinks` (its token, and Is The
 * Marionette), beside the Demon in seat 1; `others` sit after. The script holds the
 * Marionette, `thinks` and everyone cast, unless `onScript` leaves the Marionette's partner off.
 */
export function marionetteAs(
	thinks: CharacterId,
	others: CharacterId[],
	onScript = true
): Scenario {
	const ids = [...new Set(['marionette', thinks, ...others])];
	const script = scriptOf(onScript ? ids : ids.filter((id) => id !== thinks));
	return scenario([thinks, ...others], { script })
		.do((at) => ({ type: 'SetAlignment', seatId: at.seat(0), alignment: 'evil' }))
		.reminder(0, 'marionette', 'Is The Marionette');
}

/** The setup sheet's check of the table as it is: each seat as its true character. */
export function tableSetup(s: Scenario) {
	const inPlay = s.game.seating.flatMap((seatId) => {
		const id = trueCharacter(s.game, seatId, s.characters);
		const character = id === undefined ? undefined : s.characters.get(id);
		return character ? [character] : [];
	});
	return analyseSetup({
		players: s.game.seating.length,
		inPlay,
		abilities: gainedSetupAbilities(s.game, s.characters),
		findById: (id) => s.characters.get(id)
	});
}
