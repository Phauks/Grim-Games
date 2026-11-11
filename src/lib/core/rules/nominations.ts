/**
 * Nominations (https://wiki.bloodontheclocktower.com/Glossary, "Nomination"): who nominated
 * whom today, from the day log the engine keeps (`Nominate`, `EditNomination` and
 * `RemoveDayEntry` record them; the engine warns on a second nomination by or of a player, or
 * a dead nominator). Special rules that act on a nomination read them from here.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { AfterDeath } from '#lib/core/data/after-death-rules.ts';
import type {
	NominatedEffect,
	NominatingEffect,
	OnNominated
} from '#lib/core/data/character-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { rulesFor } from './rules-for.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import {
	alignmentOf,
	isTraveller,
	registersAsDead,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import type { DayEntry, Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, registrations } from './ability.ts';
import { heldAbilitiesOf } from './gained-abilities.ts';
import { ownJinxEffects } from './jinxes.ts';

/**
 * The abilities `seatId` has now: its own character's, while it works, and each it holds
 * without a token that works (`heldAbilitiesOf`, the Virgin's the Boffin gave the Demon).
 */
function workingAbilities(game: Game, seatId: SeatId, characters: CharacterLookup): CharacterId[] {
	const own = trueCharacter(game, seatId, characters);
	const held = heldAbilitiesOf(game, seatId, characters)
		.filter((h) => h.works)
		.map((h) => h.characterId);
	const works = own !== undefined && abilityState(game, seatId, characters).works;
	return [...new Set([...(works ? [own] : []), ...held])];
}

export type Nomination = Extract<DayEntry, { kind: 'nomination' }>;

/** Today's nominations, in the order they were made. */
export function todaysNominations(game: Game): Nomination[] {
	return game.today.entries.filter((e): e is Nomination => e.kind === 'nomination');
}

/**
 * Whether the Storyteller may be nominated and executed in this game: a character on the
 * script, in a seat or in play as a rule character has a `storyteller-executed` end (the
 * Atheist; Trevor, 2026-11-02: an option in every game that has one or could have one), or
 * it already happened today.
 */
export function storytellerNominee(game: Game, characters: CharacterLookup): boolean {
	if (
		game.today.entries.some(
			(e) => e.kind === 'storyteller-nomination' || e.kind === 'storyteller-execution'
		)
	)
		return true;
	const ids = new Set<CharacterId>(game.ruleCharacters);
	for (const entry of game.script.entries)
		ids.add(entry.kind === 'official' ? entry.id : entry.character.id);
	for (const seatId of game.seating) {
		const id = trueCharacter(game, seatId, characters);
		if (id) ids.add(id);
	}
	return [...ids].some((id) => endsOnStorytellerExecution(id, characters));
}

/** Whether a character lets the Storyteller be executed (`storyteller-executed`, the Atheist). */
function endsOnStorytellerExecution(id: CharacterId, characters: CharacterLookup): boolean {
	return !!rulesOf(id, characters)?.gameEnd?.ends?.some(
		(e) => e.kind === 'condition' && e.event === 'storyteller-executed'
	);
}

/** The players who nominated the Storyteller today. */
export function storytellerNominators(game: Game): SeatId[] {
	return game.today.entries.flatMap((e) =>
		e.kind === 'storyteller-nomination' ? [e.nominator] : []
	);
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
	if (!registersAsDead(game, seatId, characters)) return undefined;
	// Drunk or poisoned as they died: no power gained (https://wiki.bloodontheclocktower.com/Banshee).
	if (game.seats[seatId]?.impairedAtDeath) return undefined;
	// Their own character's, or one they hold without a token (the Banshee's the Boffin gave
	// the Demon, https://wiki.bloodontheclocktower.com/Boffin).
	const own = trueCharacter(game, seatId, characters);
	const held = heldAbilitiesOf(game, seatId, characters).map((h) => h.characterId);
	const cause = game.seats[seatId]?.deathCause;
	for (const characterId of [...(own === undefined ? [] : [own]), ...held]) {
		const rule = rulesFor(game, characterId, characters)?.afterDeath;
		if (!rule) continue;
		if (cause === undefined || rule.cause.includes(cause)) return rule;
		if (rule.cause.includes('demon') && characters.get(cause)?.type === 'demon') return rule;
	}
	return undefined;
}

/**
 * How many nominations a player may make today (https://wiki.bloodontheclocktower.com/Glossary,
 * "Nomination"): one while alive, none once dead, unless their character says otherwise
 * (`afterDeath`). Each nomination of the Storyteller that a jinx has nominate again
 * (`storytellerRenominations`) adds one.
 */
export function nominationsPerDay(game: Game, seatId: SeatId, characters: CharacterLookup): number {
	const again = storytellerRenominations(game, seatId, characters);
	if (!registersAsDead(game, seatId, characters)) return 1 + again;
	const own = afterDeath(game, seatId, characters)?.nominations ?? 0;
	return Math.max(own, nomineeNominatesNow(game, seatId, characters) ? 1 : 0) + again;
}

/**
 * The characters whose nominees nominate straight away now (`nomineesNominate`, the Riot on
 * day 3, https://wiki.bloodontheclocktower.com/Riot): a player of that character whose ability
 * works, with that reminder of it in play, and nobody stopped it today (a jinx's
 * `ability-stopped` end, recorded as the partner's day use with `stops`).
 */
export function nomineesNominateNow(game: Game, characters: CharacterLookup): CharacterId[] {
	const marked = (characterId: CharacterId, label: string) =>
		game.seating.some((s) =>
			game.seats[s]?.reminders.some((r) => r.characterId === characterId && r.label === label)
		);
	const stopped = (characterId: CharacterId) =>
		game.today.entries.some((e) => e.kind === 'ability' && e.stops === characterId);
	const out = new Set<CharacterId>();
	for (const s of game.seating) {
		const id = trueCharacter(game, s, characters);
		const token = id === undefined ? undefined : rulesFor(game, id, characters)?.nomineesNominate;
		if (id === undefined || token === undefined || out.has(id)) continue;
		if (marked(id, token) && !stopped(id) && abilityState(game, s, characters).works) out.add(id);
	}
	return [...out];
}

/**
 * Whether a dead player was nominated today while a nominee who dies nominates straight away
 * (`nomineesNominateNow`), and has not nominated since.
 */
function nomineeNominatesNow(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	const entries = game.today.entries;
	const received = entries.findLastIndex((e) => e.kind === 'nomination' && e.nominee === seatId);
	if (received < 0) return false;
	const since = entries.slice(received + 1);
	if (since.some((e) => e.kind === 'nomination' && e.nominator === seatId)) return false;
	return nomineesNominateNow(game, characters).length > 0;
}

/**
 * How many times `seatId` nominated the Storyteller today while a character whose nominees
 * nominate straight away (`nomineesNominateNow`) has a `storytellerChooses` `own-execution`
 * jinx on the script with a partner that lets the Storyteller be executed (M58).
 * The Storyteller is voted on instead, and is executed (`ExecuteStoryteller`, the game ends)
 * when the Storyteller judges them about to die; otherwise the nominator nominates again, so
 * each such nomination gives them one more today (the Riot with the Atheist, each page's
 * Related Jinxes, https://wiki.bloodontheclocktower.com/Riot).
 */
export function storytellerRenominations(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): number {
	const made = storytellerNominators(game).filter((s) => s === seatId).length;
	if (made === 0) return 0;
	const voted = nomineesNominateNow(game, characters).some((id) =>
		ownJinxEffects(
			game,
			id,
			'storytellerChooses',
			characters,
			(e) => e.what === 'own-execution'
		).some(({ partner }) => endsOnStorytellerExecution(partner, characters))
	);
	return voted ? made : 0;
}

/**
 * Whether a player may nominate at all today (`nominationsPerDay`). A character's limit for the
 * whole game (`nominationsLeftThisGame`, the Golem) only warns when they nominate (warn, never
 * lock), so it doesn't count here.
 */
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
			: rulesFor(game, characterId, characters)?.nominationsAfterExecution;
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
 * Whether executing `seatId` now is a further execution today that an extra nomination made it
 * possible (`extraNominationOpen`, the Butcher, https://wiki.bloodontheclocktower.com/Butcher):
 * their latest nomination today was one, and nobody has been executed since it.
 */
export function extraExecutionOpen(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): boolean {
	const entries = game.today.entries;
	const at = entries.findLastIndex((e) => e.kind === 'nomination' && e.nominee === seatId);
	const nomination = entries[at];
	if (at < 0 || nomination?.kind !== 'nomination') return false;
	if (entries.slice(at + 1).some((e) => e.kind === 'execution')) return false;
	const before: Game = { ...game, today: { ...game.today, entries: entries.slice(0, at) } };
	return extraNominationOpen(before, nomination.nominator, characters);
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
			!!rulesFor(game, characterId, characters)?.nominationsAfterExecution &&
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
	kind: NominatedEffect | NominatingEffect | 'nominee-chooses';
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
		...nominatorAbilityPrompts(game, nomination, characters),
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
	const chooses = (id: CharacterId) =>
		rulesFor(game, id, characters)?.madness?.chosenBy === 'nominee';
	const seated = game.seating.flatMap((seatId) => {
		const id = trueCharacter(game, seatId, characters);
		return id !== undefined && chooses(id) && abilityState(game, seatId, characters).works
			? [id]
			: [];
	});
	return [...new Set([...game.ruleCharacters.filter(chooses), ...seated])];
}

/**
 * Whether an `onNominated` effect can happen for this nomination, so a prompt never asks about
 * something that can't: only while `minAlive` players live and the nominator is alive; an
 * `evil-swap` only when both are alive and evil and neither is a Traveller (The Warrens,
 * https://beardytas.com/garden-of-djinn/the-warrens/: Travellers still count among the living).
 */
export function nominatedEffectHolds(
	game: Game,
	nomination: { nominator: SeatId; nominee: SeatId },
	rule: Pick<OnNominated, 'effect' | 'minAlive'>,
	characters: CharacterLookup
): boolean {
	const { nominator, nominee } = nomination;
	const alive = (seatId: SeatId) => !!game.seats[seatId] && !game.seats[seatId].dead;
	const living = game.seating.filter(alive).length;
	if (living < (rule.minAlive ?? 0)) return false;
	if (rule.effect === 'evil-swap') {
		const evil = (seatId: SeatId) =>
			alive(seatId) &&
			alignmentOf(game, seatId) === 'evil' &&
			!isTraveller(game, seatId, characters);
		return nominator !== nominee && evil(nominator) && evil(nominee);
	}
	if (rule.effect === 'nominator-may-die') return alive(nominator);
	return true;
}

/**
 * The abilities a nomination sets off (`onNominated`): the nominee's own (the Virgin), and any
 * player's whose `carrier` reminder the nominee has (the Gnome's Amigo,
 * https://wiki.bloodontheclocktower.com/Gnome: the Gnome may kill whoever nominates them, any
 * number of times). Each only while its ability works and isn't spent (a "No Ability" reminder
 * of its own or, with `first`, an earlier nomination of the player logged), and when the
 * nominator is, or might register as, its `by` type, if it has one.
 */
function nomineeAbilityPrompts(
	game: Game,
	nomination: { nominator: SeatId; nominee: SeatId },
	characters: CharacterLookup
): CharacterNominationPrompt[] {
	const { nominator, nominee } = nomination;
	if (nominator === nominee) return [];
	const carried = game.seats[nominee]?.reminders ?? [];
	return game.seating.flatMap((seatId) =>
		workingAbilities(game, seatId, characters).flatMap(
			(characterId): CharacterNominationPrompt[] => {
				const rule = rulesFor(game, characterId, characters)?.onNominated;
				if (!rule) return [];
				const setOff = rule.carrier
					? carries(carried, characterId, rule.carrier, seatId)
					: seatId === nominee;
				if (!setOff) return [];
				const spent = game.seats[seatId]?.reminders.some(
					(r) => r.characterId === characterId && r.label === 'No Ability'
				);
				if (spent || (rule.first && nominationsOf(game, nominee) > 1)) return [];
				const by = rule.by;
				const registersAs =
					by === undefined ||
					typeOf(game, nominator, characters) === by ||
					registrations(game, characters).some(
						(r) => r.seatId === nominator && r.types.includes(by)
					);
				return registersAs && nominatedEffectHolds(game, nomination, rule, characters)
					? [{ kind: rule.effect, characterId, nominator, nominee }]
					: [];
			}
		)
	);
}

/** How many nominations of `seatId` are logged, on any day (this one included, once logged). */
function nominationsOf(game: Game, seatId: SeatId): number {
	return [...game.pastDays, game.today]
		.flatMap((day) => day.entries)
		.filter((e) => e.kind === 'nomination' && e.nominee === seatId).length;
}

/** Whether `reminders` hold `label` of `characterId`, placed by `ownerSeatId` or nobody known. */
function carries(
	reminders: readonly { characterId: CharacterId; label: string; ownerSeatId?: SeatId }[],
	characterId: CharacterId,
	label: string,
	ownerSeatId: SeatId
): boolean {
	return reminders.some(
		(r) =>
			r.characterId === characterId &&
			r.label === label &&
			(r.ownerSeatId === undefined || r.ownerSeatId === ownerSeatId)
	);
}

/**
 * The abilities nominating sets off (`onNominating`): the nominator's own, or any player's
 * whose `carrier` reminder the nominator has (the Witch's Cursed,
 * https://wiki.bloodontheclocktower.com/Witch: a cursed player who nominates dies). Each only
 * while its ability works, a dead player's kept one included (the Vigormortis's Has Ability).
 */
function nominatorAbilityPrompts(
	game: Game,
	nomination: { nominator: SeatId; nominee: SeatId },
	characters: CharacterLookup
): CharacterNominationPrompt[] {
	const { nominator } = nomination;
	const carried = game.seats[nominator]?.reminders ?? [];
	return game.seating.flatMap((seatId) =>
		workingAbilities(game, seatId, characters).flatMap(
			(characterId): CharacterNominationPrompt[] => {
				const rule = rulesFor(game, characterId, characters)?.onNominating;
				if (!rule) return [];
				const setOff = rule.carrier
					? carries(carried, characterId, rule.carrier, seatId)
					: seatId === nominator;
				return setOff ? [{ kind: rule.effect, characterId, ...nomination }] : [];
			}
		)
	);
}

/**
 * Characters whose ability works now and means only the Storyteller nominates
 * (`nominating.by`, the Bishop, https://wiki.bloodontheclocktower.com/Bishop): a player's
 * character, or a Fabled or Loric in play. A nomination recorded meanwhile is still logged,
 * with the nominator the Storyteller picks.
 */
export function storytellerNominates(game: Game, characters: CharacterLookup): CharacterId[] {
	const only = (id: CharacterId) => {
		const rule = rulesFor(game, id, characters)?.nominating;
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
	const rules = characterId === undefined ? undefined : rulesFor(game, characterId, characters);
	const rule = rules?.nominating;
	if (characterId === undefined || !rule || !('perGame' in rule)) return undefined;
	if (!abilityState(game, seatId, characters).works) return undefined;
	const all = [...game.pastDays, game.today]
		.flatMap((day) => day.entries)
		.filter(
			(e) =>
				(e.kind === 'nomination' || e.kind === 'storyteller-nomination') && e.nominator === seatId
		);
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
