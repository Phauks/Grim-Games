/**
 * Shared set-up for the Alchemist's jinxes (each page's Related Jinxes on the wiki,
 * https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes): the good Alchemist whose
 * token was swapped for the Minion whose ability they have, on a script with both.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import { analyseSelection, type BagSelection } from '#lib/core/rules/setup/bag-plan.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scriptOf } from './summoner.test-support.ts';

export { scriptOf };

/**
 * Seat 0 is the good Alchemist with `minion`'s ability (its token, and Is The Alchemist);
 * `others` sit after it. The script holds the Alchemist, `minion` and everyone cast.
 */
export function alchemistAs(minion: CharacterId, others: CharacterId[]): Scenario {
	const ids = [...new Set(['alchemist', minion, ...others])];
	return scenario([minion, ...others], { script: scriptOf(ids) })
		.do((at) => ({ type: 'SetAlignment', seatId: at.seat(0), alignment: 'good' }))
		.reminder(0, 'alchemist', 'Is The Alchemist');
}

const pick = (...ids: string[]): BagSelection => Object.fromEntries(ids.map((id) => [id, 1]));

/**
 * The setup notes for a 7-player bag of the Alchemist and Trouble Brewing characters, on a
 * script with `partner` (or without it, with `onScript: false`).
 */
export function bagNotes(partner: CharacterId, onScript = true): string[] {
	const data = committedGameData();
	const script = ['alchemist', 'chef', 'empath', 'monk', 'soldier', 'mayor', 'poisoner', 'imp'];
	const scriptOrder = onScript ? [...script, partner] : script;
	return analyseSelection({
		players: 7,
		selection: pick('alchemist', 'chef', 'empath', 'monk', 'soldier', 'poisoner', 'imp'),
		scriptOrder,
		lookup: (id) => data.byId.get(id)
	}).notes;
}
