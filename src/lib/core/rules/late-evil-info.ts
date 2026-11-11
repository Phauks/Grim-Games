/**
 * The Minion info and Demon info steps on a night after the first. A character whose
 * `evilInfo.wakeToken` reminder is on a player tonight brings both steps back, right after
 * its own step (the Poppy Grower's Evil Wakes: once it dies, the Minions and Demon learn each
 * other that night, https://wiki.bloodontheclocktower.com/Poppy_Grower).
 */
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game } from '#lib/core/model/types.ts';
import { MARKER_TEXT, type Night, type NightStep } from './night-order.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

/** The character whose wake token is on a player, if any. */
function wokenBy(game: Game, characters: CharacterLookup): string | undefined {
	for (const seatId of game.seating) {
		for (const r of game.seats[seatId].reminders) {
			const token = rulesFor(game, r.characterId, characters)?.evilInfo?.wakeToken;
			if (token !== undefined && token === r.label) return r.characterId;
		}
	}
	return undefined;
}

export function withLateEvilInfoSteps<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup,
	night: Night
): (T | NightStep)[] {
	if (night === 'first') return [...steps];
	if (steps.some((s) => s.id === 'minioninfo' || s.id === 'demoninfo')) return [...steps];
	const by = wokenBy(game, characters);
	if (!by) return [...steps];
	const name = characters.get(by)?.name ?? by;
	const marker = (id: 'minioninfo' | 'demoninfo'): NightStep => ({
		id,
		kind: 'marker',
		reminder: MARKER_TEXT[id].other,
		afterDawn: false,
		placement: 'marker',
		notes: [`${name}: its reminder is on, so the Minions and Demon learn each other tonight.`]
	});
	const own = steps.findIndex((s) => s.id === by);
	// Right after its own step, or after Dusk when it has none tonight.
	const at = own >= 0 ? own + 1 : Math.max(steps.findIndex((s) => s.id === 'dusk') + 1, 0);
	return [...steps.slice(0, at), marker('minioninfo'), marker('demoninfo'), ...steps.slice(at)];
}
