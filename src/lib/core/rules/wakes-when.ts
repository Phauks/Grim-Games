/**
 * Whether a character's own condition for waking holds tonight (`wakesWhen` in its rules
 * block, `data/wakes-when-rules.ts`): the King once the dead equal or outnumber the living,
 * the Choirboy when the Demon killed the King tonight, the Godfather on a later night only when
 * an Outsider died today, the Zombuul when nobody died today, the
 * Seamstress until its once-per-game ability is used (unless its player acts twice,
 * `acts-twice.ts`: a spent once-per-game ability may be used again), the Zombuul while no
 * player is marked Died Today, the Bounty Hunter on a later night once the player marked Know
 * died, the Juggler only on the night after the first day, the Damsel only when a player
 * became the Damsel since the day began. `diedTonight` is every seat that died since the most
 * recent New day (`diedSinceNewDay`); `became` is every seat whose character changed since
 * then (`changedCharacters`). Every condition given must hold;
 * a character without one always may wake. Its rules are read as they are in the game, so a
 * jinx may lower the King's dead count while its partner is in play (the verb `deadAtLeast`, a
 * patch of `wakesWhen.deadAtLeast`: one dead player is enough with the Leviathan or Riot,
 * https://wiki.bloodontheclocktower.com/King#Related_Jinxes).
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { actsTwice } from './acts-twice.ts';
import { dayNumber } from './night-order.ts';
import { rulesFor } from './rules-for.ts';

export function wakeConditionMet(
	game: Game,
	characterId: CharacterId,
	holder: SeatId,
	characters: CharacterLookup,
	diedTonight: ReadonlySet<SeatId>,
	became: ReadonlySet<SeatId> = new Set()
): boolean {
	const when = rulesFor(game, characterId, characters, { seatId: holder })?.wakesWhen;
	if (!when) return true;
	if (when.deadAtLeastLiving || when.deadAtLeast !== undefined) {
		const dead = game.seating.filter((s) => game.seats[s].dead).length;
		const living = when.deadAtLeastLiving === true && dead >= game.seating.length - dead;
		const count = when.deadAtLeast !== undefined && dead >= when.deadAtLeast;
		if (!living && !count) return false;
	}
	if (when.diedTonight) {
		const { characters: ids, by } = when.diedTonight;
		const set = [...diedTonight].some((s) => {
			const id = trueCharacter(game, s, characters);
			if (id === undefined || !ids.includes(id)) return false;
			// A death whose cause was not recorded counts, so the step still shows (warn, never lock).
			const cause = game.seats[s]?.deathCause;
			return (
				!by || cause === undefined || cause === 'demon' || characters.get(cause)?.type === 'demon'
			);
		});
		if (!set) return false;
	}
	if (when.diedToday && dayNumber(game) > 0) {
		// An Outsider died today: its token marks them, or, if the token was not placed, a death
		// since the day began still counts, so the step shows (warn, never lock).
		const { types, token } = when.diedToday;
		const marked =
			token !== undefined &&
			game.seating.some((s) =>
				game.seats[s]?.reminders.some((r) => r.characterId === characterId && r.label === token)
			);
		const died = [...diedTonight].some((s) => {
			const id = trueCharacter(game, s, characters);
			const type = id === undefined ? undefined : characters.get(id)?.type;
			return type !== undefined && types.includes(type);
		});
		if (!marked && !died) return false;
	}
	if (when.nobodyDiedToday) {
		// Today's deaths: the log's, and any execution or exile today that killed.
		const executed = game.today.entries.some(
			(e) => (e.kind === 'execution' || e.kind === 'exile') && e.died
		);
		if (executed || [...diedTonight].some((s) => game.seats[s]?.dead)) return false;
	}
	if (when.untilToken) {
		const spent = game.seats[holder]?.reminders.some(
			(r) => r.characterId === characterId && r.label === when.untilToken
		);
		if (spent && !actsTwice(game, holder, characters)) return false;
	}
	const marked = (label: string) =>
		game.seating.filter((s) =>
			game.seats[s]?.reminders.some((r) => r.characterId === characterId && r.label === label)
		);
	if (when.noneMarked && marked(when.noneMarked).length > 0) return false;
	if (when.markedDied && dayNumber(game) > 0) {
		// The marked player died, or an evil player died since the day began: the Storyteller may
		// have moved the token on to the next evil player already, and the step stays.
		const died =
			marked(when.markedDied).some((s) => game.seats[s].dead) ||
			[...diedTonight].some((s) => alignmentOf(game, s) === 'evil');
		if (!died) return false;
	}
	if (when.nightAfterDay !== undefined && dayNumber(game) !== when.nightAfterDay) return false;
	if (when.becameToday && !became.has(holder)) return false;
	return true;
}
