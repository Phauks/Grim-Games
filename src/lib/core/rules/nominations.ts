/**
 * Nominations (https://wiki.bloodontheclocktower.com/Glossary, "Nomination"): who nominated
 * whom today, from the day log the engine keeps (`Nominate`, `EditNomination` and
 * `RemoveDayEntry` record them; the engine warns on a second nomination by or of a player, or
 * a dead nominator). Special rules that act on a nomination read them from here.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { AfterDeath } from '#lib/core/data/after-death-rules.ts';
import type { NominatedEffect } from '#lib/core/data/character-rules.ts';
import { rulesIn, rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { registersAsDead, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { DayEntry, Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, registrations } from './ability.ts';

export type Nomination = Extract<DayEntry, { kind: 'nomination' }>;

/** Today's nominations, in the order they were made. */
export function todaysNominations(game: Game): Nomination[] {
	return game.today.entries.filter((e): e is Nomination => e.kind === 'nomination');
}

/**
 * A seat's part in today's nominations: the latest it made (`allMade` has every one, for a
 * player who may nominate more than once) and the latest it received, if any.
 */
export function seatNominations(
	game: Game,
	seatId: SeatId
): { made?: Nomination; received?: Nomination; allMade: Nomination[] } {
	const today = todaysNominations(game);
	const allMade = today.filter((n) => n.nominator === seatId);
	const made = allMade.at(-1);
	const received = today.findLast((n) => n.nominee === seatId);
	return { ...(made ? { made } : {}), ...(received ? { received } : {}), allMade };
}

/**
 * What a dead player's character still lets them do (`afterDeath`, the Banshee killed by the
 * Demon), or undefined: alive, no such rule, or a death of another cause. A death whose cause
 * was not recorded counts, so the Storyteller is still offered the choice.
 */
export function afterDeath(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): AfterDeath | undefined {
	if (!registersAsDead(game, seatId)) return undefined;
	// Drunk or poisoned as they died: no power gained (https://wiki.bloodontheclocktower.com/Banshee).
	if (game.seats[seatId]?.impairedAtDeath) return undefined;
	const characterId = trueCharacter(game, seatId, characters);
	const rule = characterId === undefined ? undefined : rulesOf(characterId, characters)?.afterDeath;
	if (!rule) return undefined;
	const cause = game.seats[seatId]?.deathCause;
	if (cause === undefined || rule.cause.includes(cause)) return rule;
	return rule.cause.includes('demon') && characters.get(cause)?.type === 'demon' ? rule : undefined;
}

/**
 * How many nominations a player may make today (https://wiki.bloodontheclocktower.com/Glossary,
 * "Nomination"): one while alive, none once dead, unless their character says otherwise
 * (`afterDeath`).
 */
export function nominationsPerDay(game: Game, seatId: SeatId, characters: CharacterLookup): number {
	if (!registersAsDead(game, seatId)) return 1;
	return afterDeath(game, seatId, characters)?.nominations ?? 0;
}

/** Whether a player may nominate at all today (`nominationsPerDay`). */
export function mayNominate(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	return nominationsPerDay(game, seatId, characters) > 0;
}

/**
 * Whether `nominator`'s next nomination today is an extra one their character allows after the
 * day's first execution (`nominationsAfterExecution`, the Butcher): the once-a-day limits don't
 * apply to it, for them or their nominee. Only while their ability works. `ignore` leaves out a
 * nomination being changed.
 */
export function extraNominationOpen(
	game: Game,
	nominator: SeatId,
	characters: CharacterLookup,
	ignore?: string
): boolean {
	const characterId = trueCharacter(game, nominator, characters);
	const extra =
		characterId === undefined
			? undefined
			: rulesOf(characterId, characters)?.nominationsAfterExecution;
	if (!extra || !abilityState(game, nominator, characters).works) return false;
	const entries = game.today.entries.filter((e) => e.entryId !== ignore);
	const first = entries.findIndex((e) => e.kind === 'execution');
	if (first < 0) return false;
	const since = entries
		.slice(first + 1)
		.filter((e) => e.kind === 'nomination' && e.nominator === nominator).length;
	return since < extra;
}

/**
 * Players whose ability may give them a nomination after an execution
 * (`nominationsAfterExecution`) and works now, whether or not today has an execution yet.
 */
export function extraNominators(game: Game, characters: CharacterLookup): SeatId[] {
	return game.seating.filter((seatId) => {
		const characterId = trueCharacter(game, seatId, characters);
		return (
			characterId !== undefined &&
			!!rulesOf(characterId, characters)?.nominationsAfterExecution &&
			abilityState(game, seatId, characters).works
		);
	});
}

/**
 * Who may still nominate once `executed` is executed today (`extraNominationOpen`, as if that
 * execution were logged), for Execution to offer keeping the day going. A player the execution
 * kills is left out. With no `executed`, today's log as it stands.
 */
export function nominatorsAfterExecution(
	game: Game,
	executed: { seatId: SeatId; dies: boolean } | undefined,
	characters: CharacterLookup
): SeatId[] {
	const logged =
		!executed ||
		game.today.entries.some((e) => e.kind === 'execution' && e.seatId === executed.seatId);
	const after: Game = logged
		? game
		: {
				...game,
				today: {
					...game.today,
					entries: [
						...game.today.entries,
						{
							kind: 'execution',
							entryId: 'pending' as DayEntry['entryId'],
							seatId: executed.seatId,
							died: executed.dies
						}
					]
				}
			};
	return game.seating.filter(
		(seatId) =>
			!(executed?.dies && executed.seatId === seatId && !logged) &&
			extraNominationOpen(after, seatId, characters)
	);
}

/**
 * A character's ability a nomination sets off, for the board to offer (warn, never lock):
 * the nominee's own (`onNominated`), or `nominee-chooses`, a character in play that has the
 * nominee choose a player (`madness.chosenBy`, the Big Wig).
 */
export interface CharacterNominationPrompt {
	kind: NominatedEffect | 'nominee-chooses';
	/** The character whose ability it is. */
	characterId: CharacterId;
	nominator: SeatId;
	nominee: SeatId;
}

/**
 * What a nomination sets off by the nominee's character (`onNominated` in its rules), only
 * while it can happen: the nominee's ability works and isn't spent (no "No Ability" reminder
 * of its own), and the nominator is, or might register as, the `by` type. For the Virgin
 * (https://wiki.bloodontheclocktower.com/Virgin) a Townsfolk nominator is executed
 * straight away. A Spy might register as a Townsfolk, so a Spy nominator is asked about too.
 */
export function characterNominationPrompts(
	game: Game,
	nomination: { nominator: SeatId; nominee: SeatId },
	characters: CharacterLookup
): CharacterNominationPrompt[] {
	return [
		...nomineeAbilityPrompts(game, nomination, characters),
		...nomineeChooses(game, characters).map((characterId): CharacterNominationPrompt => ({
			kind: 'nominee-chooses',
			characterId,
			...nomination
		}))
	];
}

/**
 * Characters in play that have each nominee choose a player (`madness.chosenBy: 'nominee'`,
 * https://wiki.bloodontheclocktower.com/Big_Wig): a Fabled or Loric in play, or a player's
 * character while their ability works.
 */
export function nomineeChooses(game: Game, characters: CharacterLookup): CharacterId[] {
	const chooses = (id: CharacterId) => rulesOf(id, characters)?.madness?.chosenBy === 'nominee';
	const seated = game.seating.flatMap((seatId) => {
		const id = trueCharacter(game, seatId, characters);
		return id !== undefined && chooses(id) && abilityState(game, seatId, characters).works
			? [id]
			: [];
	});
	return [...new Set([...game.ruleCharacters.filter(chooses), ...seated])];
}

/**
 * The abilities a nomination sets off (`onNominated`): the nominee's own (the Virgin), and any
 * player's whose `carrier` reminder the nominee has (the Gnome's Amigo,
 * https://wiki.bloodontheclocktower.com/Gnome: the Gnome may kill whoever nominates them, any
 * number of times). Each only while its ability works and isn't spent (a "No Ability" reminder
 * of its own), and when the nominator is, or might register as, its `by` type, if it has one.
 */
function nomineeAbilityPrompts(
	game: Game,
	nomination: { nominator: SeatId; nominee: SeatId },
	characters: CharacterLookup
): CharacterNominationPrompt[] {
	const { nominator, nominee } = nomination;
	if (nominator === nominee) return [];
	const carried = game.seats[nominee]?.reminders ?? [];
	return game.seating.flatMap((seatId): CharacterNominationPrompt[] => {
		const characterId = trueCharacter(game, seatId, characters);
		const rule =
			characterId === undefined ? undefined : rulesIn(game, characterId, characters)?.onNominated;
		if (characterId === undefined || !rule) return [];
		const setOff = rule.carrier
			? carried.some(
					(r) =>
						r.characterId === characterId &&
						r.label === rule.carrier &&
						(r.ownerSeatId === undefined || r.ownerSeatId === seatId)
				)
			: seatId === nominee;
		if (!setOff || !abilityState(game, seatId, characters).works) return [];
		const spent = game.seats[seatId]?.reminders.some(
			(r) => r.characterId === characterId && r.label === 'No Ability'
		);
		if (spent) return [];
		const by = rule.by;
		const registersAs =
			by === undefined ||
			typeOf(game, nominator, characters) === by ||
			registrations(game, characters).some((r) => r.seatId === nominator && r.types.includes(by));
		return registersAs ? [{ kind: rule.effect, characterId, nominator, nominee }] : [];
	});
}

/**
 * Characters whose ability works now and means only the Storyteller nominates
 * (`nominating.by`, the Bishop, https://wiki.bloodontheclocktower.com/Bishop): a player's
 * character, or a Fabled or Loric in play. A nomination recorded meanwhile is still logged,
 * with the nominator the Storyteller picks.
 */
export function storytellerNominates(game: Game, characters: CharacterLookup): CharacterId[] {
	const only = (id: CharacterId) => {
		const rule = rulesIn(game, id, characters)?.nominating;
		return !!rule && 'by' in rule && rule.by === 'storyteller';
	};
	const seated = game.seating.flatMap((seatId) => {
		const id = trueCharacter(game, seatId, characters);
		return id !== undefined && only(id) && abilityState(game, seatId, characters).works ? [id] : [];
	});
	return [...new Set([...game.ruleCharacters.filter(only), ...seated])];
}

/**
 * How many more nominations a player's character lets them make this game
 * (`nominating.perGame`, the Golem, https://wiki.bloodontheclocktower.com/Golem: once per
 * game), while its ability works; undefined when no such limit applies. Counts the
 * nominations the day logs hold for the seat, and at least one once the character's spent
 * reminder (`dayUse.spentToken`, else "No Ability") is on it. `ignore` leaves out a nomination
 * being changed.
 */
export function nominationsLeftThisGame(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	ignore?: string
): { characterId: CharacterId; left: number } | undefined {
	const characterId = trueCharacter(game, seatId, characters);
	const rules = characterId === undefined ? undefined : rulesIn(game, characterId, characters);
	const rule = rules?.nominating;
	if (characterId === undefined || !rule || !('perGame' in rule)) return undefined;
	if (!abilityState(game, seatId, characters).works) return undefined;
	const all = [...game.pastDays, game.today]
		.flatMap((day) => day.entries)
		.filter((e) => e.kind === 'nomination' && e.nominator === seatId);
	const made = all.filter((e) => e.entryId !== ignore);
	// Changing the nomination that spent it doesn't count the spent reminder again.
	const editing = made.length < all.length;
	const spentLabel = rules?.dayUse?.spentToken ?? 'No Ability';
	const spent = game.seats[seatId]?.reminders.some(
		(r) => r.characterId === characterId && r.label === spentLabel
	);
	const used = Math.max(made.length, spent && !editing ? 1 : 0);
	return { characterId, left: Math.max(rule.perGame - used, 0) };
}
