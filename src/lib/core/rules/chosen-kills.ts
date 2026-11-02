/**
 * Night kills whose choice is not simply a player (`kills.chooses` in a character's rules):
 *
 * - `character`: the ability names a character, and that character's player dies; when it is
 *   not in play, the Storyteller chooses who dies, any player at all (the Ojo,
 *   https://wiki.bloodontheclocktower.com/Ojo). With several copies in play only one dies.
 * - `live-or-die`: the players its reminders mark each choose to live or die, in the order of
 *   those reminders; a dead player who chooses to live comes back to life, and if all of them
 *   are alive once everyone has chosen, they all die (the Al-Hadikhia,
 *   https://wiki.bloodontheclocktower.com/Al-Hadikhia). A player who chose to die but did not
 *   (protected, say) counts as alive.
 *
 * The night step offers these; the Storyteller decides, so nothing here happens on its own.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { inPlay, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';

/** What `characterId`'s night kill chooses instead of a player, if anything. */
export function killChoice(
	characterId: CharacterId,
	characters?: CharacterLookup
): 'character' | 'live-or-die' | undefined {
	return rulesOf(characterId, characters)?.kills?.chooses;
}

/**
 * Who may die when a character is named (`chooses: character`): the players whose true
 * character it is (registration aside), dead or alive, as a dead player's character is still
 * in play; or, with none, `storytellerChooses` and every player, as the Storyteller may pick
 * anyone (usually a living good player).
 */
export interface NamedKill {
	storytellerChooses: boolean;
	seats: SeatId[];
}

export function namedCharacterKill(
	game: Game,
	named: CharacterId,
	characters: CharacterLookup
): NamedKill {
	const seating = inPlay(game).seating;
	const holders = seating.filter((id) => trueCharacter(game, id, characters) === named);
	return holders.length > 0
		? { storytellerChooses: false, seats: holders }
		: { storytellerChooses: true, seats: [...seating] };
}

/**
 * The players `characterId`'s reminders mark (`chooses: live-or-die`), in the order of its
 * reminder list (the 1, 2 and 3), each once.
 */
export function liveOrDieChosen(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): SeatId[] {
	const labels = characters.get(characterId)?.reminders ?? [];
	const marked = game.seating.flatMap((seatId) =>
		game.seats[seatId].reminders
			.filter((r) => r.characterId === characterId && labels.includes(r.label))
			.map((r) => ({ seatId, at: labels.indexOf(r.label) }))
	);
	marked.sort((a, b) => a.at - b.at);
	return [...new Set(marked.map((m) => m.seatId))];
}

/** One chosen player's choice; `survives` when choosing to die did not kill them. */
export interface LiveOrDieChoice {
	seatId: SeatId;
	lives: boolean;
	survives?: boolean;
}

/** What happens to one chosen player, in the order chosen. */
export interface LiveOrDieResult {
	seatId: SeatId;
	/** Dead at dawn. */
	dead: boolean;
	/** Died tonight: alive at dawn's start or brought back, then killed. */
	died: boolean;
	/** Was dead, and is alive at dawn. */
	revived: boolean;
}

export interface LiveOrDieOutcome {
	/** Everyone chosen was alive after their choices, so all of them died. */
	allDie: boolean;
	results: LiveOrDieResult[];
}

/**
 * The outcome of the chosen players' choices in `game` (the game before them). Each choice
 * in turn: life brings a dead player back, death kills a living one unless they `survive`.
 * Then, if everyone chosen is alive, everyone chosen dies (those who `survive` aside).
 */
export function resolveLiveOrDie(
	game: Game,
	choices: readonly LiveOrDieChoice[]
): LiveOrDieOutcome {
	const steps = choices.map((c) => {
		const wasDead = !!game.seats[c.seatId]?.dead;
		const alive = c.lives || (!wasDead && !!c.survives);
		return { ...c, wasDead, alive, revivedOnce: wasDead && c.lives };
	});
	const allDie = steps.length > 0 && steps.every((s) => s.alive);
	return {
		allDie,
		results: steps.map((s) => {
			const dead = allDie ? !s.survives : !s.alive;
			const aliveTonight = !s.wasDead || s.revivedOnce;
			return {
				seatId: s.seatId,
				dead,
				died: dead && aliveTonight,
				revived: s.wasDead && !dead
			};
		})
	};
}
