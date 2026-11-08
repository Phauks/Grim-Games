/**
 * A night step to wake each player whose character changed since dawn and show them their
 * new character, so the Storyteller never forgets to tell them (the character changes
 * audit, Trevor 2026-10-19: "go ahead on character changes"). The wiki says the player
 * learns it: the new Imp is woken and shown "You are" and the Imp token
 * (https://wiki.bloodontheclocktower.com/Imp); so is a player the Pit-Hag changes
 * (https://wiki.bloodontheclocktower.com/Pit-Hag) or a Farmer's heir
 * (https://wiki.bloodontheclocktower.com/Farmer).
 *
 * The changes come from the game's log (`changedCharacters` in the engine). Each step goes
 * right after the step of the ability that made the change, or just before Dawn when no
 * ability did, in seating order. The step names the seat; the UI draws its player. A
 * new character's `evilInfo.lateNote` is a note on its step (a Snitch made tonight: each
 * Minion learns 3 bluffs, https://wiki.bloodontheclocktower.com/Snitch).
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { InfoTokenCharacterRules } from '#lib/core/data/info-token-rules.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { SeatId } from '#lib/core/model/types.ts';
import type { NightStep } from './night-order.ts';
import { infoTokensNamedIn } from '#lib/core/data/info-tokens.ts';

/** "You are" with the step's own character: the player's new one. */
export const SHOWN_OWN_CHARACTER: InfoTokenCharacterRules = {
	'you-are': { characters: ['self'] }
};

/** The id prefix of a wake step: `changed@<seat>`. */
const CHANGED_STEP = 'changed';

/**
 * The night steps with a wake step for each seat in `changes`: right after the step of the
 * character whose ability made the change (`by`), or before Dawn when nothing did (a change
 * by day, or by hand). None when that step's own text already shows the player "You are"
 * (Trevor, 2026-11-08: the new Imp "wake[s] up on the earlier imp ability", so no second
 * wake at the end of the night).
 */
export function withCharacterChangeSteps<T extends NightStep>(
	steps: readonly T[],
	changes: readonly { seatId: SeatId; characterId: CharacterId; by?: CharacterId }[],
	characters: CharacterLookup
): (T | NightStep)[] {
	const out: (T | NightStep)[] = [...steps];
	const beforeDawn: NightStep[] = [];
	for (const { seatId, characterId, by } of changes) {
		const character = characters.get(characterId);
		if (!character) continue;
		const cause = by ? out.findLastIndex((s) => s.character?.id === by && !s.changed) : -1;
		const told =
			cause >= 0 && infoTokensNamedIn(out[cause].reminder).some((t) => t.id === 'you-are');
		if (told) continue;
		const late = rulesOf(characterId, characters)?.evilInfo?.lateNote;
		const step: NightStep = {
			id: `${CHANGED_STEP}@${seatId}`,
			kind: 'custom',
			character,
			reminder: `Wake this player. Show the *YOU ARE* info token, then the ${character.name} token.`,
			afterDawn: false,
			placement: 'marker',
			notes: late ? [`${character.name}: ${late}`] : [],
			changed: { seatId, characterId },
			// The card shows the new character, whatever that character's own rules fill in.
			infoTokenCharacters: SHOWN_OWN_CHARACTER
		};
		if (cause >= 0 && !out[cause].afterDawn) out.splice(cause + 1, 0, step);
		else beforeDawn.push(step);
	}
	if (beforeDawn.length === 0) return out;
	const dawn = out.findIndex((s) => s.id === 'dawn');
	const afterDawn = out.findIndex((s) => s.afterDawn);
	const at = dawn >= 0 ? dawn : afterDawn >= 0 ? afterDawn : out.length;
	return [...out.slice(0, at), ...beforeDawn, ...out.slice(at)];
}
