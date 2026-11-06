/**
 * Abilities a player has from another player's character, by the `gainedFrom` rule of their
 * own character (`data/gained-from-rules.ts`). The Pixie
 * (https://wiki.bloodontheclocktower.com/Pixie), for one:
 * - the Pixie starts knowing an in-play Townsfolk, marked "Mad";
 * - when that player dies, and the Storyteller judges the Pixie was mad about being that
 *   character, the Storyteller swaps "Mad" for "Has Ability": the Pixie now has the
 *   Townsfolk's ability and wakes when that Townsfolk would normally wake (the wiki's How to
 *   Run, which puts the step at the gained character's place in the night order).
 *
 * Until "Has Ability" is placed the step is still shown, at the same place, marked
 * `if-mad`: the Storyteller makes the madness call there (swap Mad for Has Ability, or not).
 *
 * A player also has the abilities they hold without a token (`Seat.abilities`), given by
 * another character's `givesAbility` rule: the Boffin's good ability on the Demon, who
 * wakes when that good character would (https://wiki.bloodontheclocktower.com/Boffin). And
 * those their own character's `givesAbility` gives them from the script (`ownHeld`): the
 * Hermit has every other Outsider on the script, waking as each would and keeping after death
 * only those that work even if dead (https://wiki.bloodontheclocktower.com/Hermit).
 */
import type { GainedFrom } from '#lib/core/data/gained-from-rules.ts';
import type { LearnsGained } from '#lib/core/data/jinx-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { scriptCharacterIds } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, HeldAbility, SeatId } from '#lib/core/model/types.ts';
import { abilityState, worksWhenDead } from './ability.ts';
import { actsWhenDead } from './dead-characters.ts';
import { givenInstead, jinxEffect } from './jinxes.ts';
import { thinksPartnerSetup } from './jinx-effects.ts';
import type { Night, NightStep } from './night-order.ts';

export interface GainedAbility {
	/** The player who gains the ability (the Pixie). */
	seatId: SeatId;
	/** The character whose ability they gain. */
	characterId: CharacterId;
	/** The character whose ability grants it; unset when the Storyteller gave it by hand. */
	via?: CharacterId;
	/** The player whose character it was; unset for a swapped token. */
	fromSeat?: SeatId;
	/** `has-ability`: the Storyteller placed "Has Ability"; `if-mad`: still their call. */
	status: 'has-ability' | 'if-mad';
	/**
	 * Set on a night step when the gained character has no text for this night and its
	 * first-night text is used: a "you start knowing" ability gives its information the
	 * night it is gained (the Pixie's Washerwoman example on the wiki).
	 */
	firstNightText?: boolean;
	/**
	 * What the player learns tonight by a jinx, the night after gaining the ability
	 * (`learnsGainedTonight`: the Cannibal's Butler, Zealot and Juggler).
	 */
	learns?: LearnsGained;
}

/**
 * What the holder of `gained` learns tonight by the gaining character's jinx with the character
 * whose ability they gained (`learns` `ability` or `answer`): only on the night after that player died by
 * execution today, the night the ability is gained (the Cannibal's Butler, Zealot and Juggler,
 * https://wiki.bloodontheclocktower.com/Cannibal#Related_Jinxes). Read from today's log.
 */
export function learnsGainedTonight(
	game: Game,
	gained: Pick<GainedAbility, 'via' | 'characterId' | 'fromSeat'>,
	characters: CharacterLookup
): LearnsGained | undefined {
	if (gained.via === undefined) return undefined;
	const what = jinxEffect(game, gained.via, gained.characterId, 'learns', characters)?.what;
	const learns = what === 'ability' || what === 'answer' ? what : undefined;
	if (!learns || gained.fromSeat === undefined) return undefined;
	const executed = game.today.entries.some(
		(e) => e.kind === 'execution' && e.seatId === gained.fromSeat && e.died
	);
	return executed ? learns : undefined;
}

/**
 * The ability `holder` has by `via`'s `gainedFrom` rule: their swapped token, the true
 * character of the player carrying its `token`, or, while that is unplaced, of a dead player
 * carrying its `pending` token (`if-mad`).
 */
export function gainedBy(
	game: Game,
	holder: SeatId,
	via: CharacterId,
	rule: GainedFrom,
	characters: CharacterLookup
): Omit<GainedAbility, 'seatId' | 'via'> | undefined {
	const token = game.seats[holder]?.characterId;
	if (rule.swapped && token !== undefined && token !== via)
		return { characterId: token, status: 'has-ability' };
	const carrier = (label: string) =>
		game.seating.find((s) =>
			game.seats[s].reminders.some((r) => r.characterId === via && r.label === label)
		);
	const has = carrier(rule.token);
	const pending = rule.pending === undefined ? undefined : carrier(rule.pending);
	const from = has ?? (pending !== undefined && game.seats[pending].dead ? pending : undefined);
	const characterId = from === undefined ? undefined : trueCharacter(game, from, characters);
	if (from === undefined || characterId === undefined) return undefined;
	return { characterId, fromSeat: from, status: has !== undefined ? 'has-ability' : 'if-mad' };
}

/**
 * Whether `holder`'s own ability works for an ability it gives them: no drunkenness or
 * poisoning, and alive, or dead holding an ability that works even if dead.
 */
function ownGiverWorks(
	game: Game,
	holder: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): boolean {
	const seat = game.seats[holder];
	if (!seat) return false;
	const state = abilityState(game, holder, characters);
	return state.impairments.length === 0 && (!seat.dead || worksWhenDead(characterId, characters));
}

/**
 * Whether `holder` has the ability held by `via`'s `givesAbility` rule now: they are still
 * who it goes to (the Demon), and, for `whileWorks`, a player of `via` has a working ability
 * (a drunk, poisoned or dead Boffin takes it away for as long as that lasts). An entry with
 * no `via` is the Storyteller's own call and always counts. One whose `via` is the holder's
 * own true character with a `gainedFrom` rule (the Storyteller recording the ability the
 * Philosopher chose, https://wiki.bloodontheclocktower.com/Philosopher) counts while their
 * own ability works.
 */
export function holdsAbility(
	game: Game,
	holder: SeatId,
	held: HeldAbility,
	characters: CharacterLookup
): boolean {
	if (held.via === undefined) return true;
	const rules = rulesOf(held.via, characters);
	const rule = rules?.givesAbility;
	if (rule?.to === 'self') {
		// Their own ability gives it: while it works, and after death only an ability that
		// works even if dead.
		if (game.seats[holder]?.characterId !== held.via) return false;
		return ownGiverWorks(game, holder, held.characterId, characters);
	}
	if (!rule && rules?.gainedFrom) {
		if (trueCharacter(game, holder, characters) !== held.via) return false;
		return ownGiverWorks(game, holder, held.characterId, characters);
	}
	if (rule?.to === 'storyteller') {
		// A Minion holds it instead, by a jinx (the Plague Doctor's Spy,
		// https://wiki.bloodontheclocktower.com/Plague_Doctor#Related_Jinxes).
		return (
			typeOf(game, holder, characters) === 'minion' &&
			givenInstead(held.via, held.characterId, game.script, characters)?.instead === 'a-minion'
		);
	}
	if (rule?.to !== 'demon' || typeOf(game, holder, characters) !== 'demon') return false;
	if (!rule.whileWorks) return true;
	return game.seating.some(
		(s) =>
			trueCharacter(game, s, characters) === held.via && abilityState(game, s, characters).works
	);
}

/**
 * The character whose `gainedFrom` rule gives `seatId` an ability: the token they hold (the
 * Pixie, the Cannibal), or, for a token swapped for the character they chose (`swapped`),
 * their true character (the Philosopher holding the Clockmaker token).
 */
function gainingCharacter(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId | undefined {
	const token = game.seats[seatId]?.characterId;
	if (token === undefined) return undefined;
	if (rulesOf(token, characters)?.gainedFrom) return token;
	const own = trueCharacter(game, seatId, characters);
	return own !== undefined && own !== token && rulesOf(own, characters)?.gainedFrom?.swapped
		? own
		: undefined;
}

/**
 * Whether a dead player keeps an ability they have from another character: one that works
 * "even if dead" (the Recluse's) or that acts once its player is dead (the Ravenkeeper's, the
 * Sweetheart's). The wiki's Cannibal summary: the Cannibal keeps such an ability when they die,
 * but loses their Cannibal ability (https://wiki.bloodontheclocktower.com/Cannibal).
 */
export function keptWhenDead(characterId: CharacterId, characters: CharacterLookup): boolean {
	return worksWhenDead(characterId, characters) || actsWhenDead(characterId, characters);
}

/**
 * Every living player's gained (or about to be gained) ability that wakes them, and a dead
 * player's gained ability they keep after death (`keptWhenDead`). They wake by
 * the token they hold (a Drunk who thinks they are the Pixie too), or by their true character
 * when their token was swapped for the character they chose (the Philosopher's). Abilities held without a
 * token (`Seat.abilities`) follow, while `holdsAbility`.
 */
export function gainedAbilities(game: Game, characters: CharacterLookup): GainedAbility[] {
	const out: GainedAbility[] = [];
	for (const seatId of game.seating) {
		const dead = game.seats[seatId].dead;
		const via = gainingCharacter(game, seatId, characters);
		const rule = via === undefined ? undefined : rulesOf(via, characters)?.gainedFrom;
		if (via === undefined || !rule?.wakes) continue;
		const gained = gainedBy(game, seatId, via, rule, characters);
		if (!gained) continue;
		if (dead && (gained.status !== 'has-ability' || !keptWhenDead(gained.characterId, characters)))
			continue;
		const learns =
			gained.status === 'has-ability' && !dead
				? learnsGainedTonight(game, { via, ...gained }, characters)
				: undefined;
		out.push({ seatId, via, ...gained, ...(learns ? { learns } : {}) });
	}
	for (const seatId of game.seating) {
		const seat = game.seats[seatId];
		if (seat.dead) continue;
		for (const held of allHeld(game, seatId, characters)) {
			if (!holdsAbility(game, seatId, held, characters)) continue;
			// Already gained by their token (a Philosopher's swapped token, also recorded here).
			if (out.some((g) => g.seatId === seatId && g.characterId === held.characterId)) continue;
			out.push({
				seatId,
				...(held.via !== undefined ? { via: held.via } : {}),
				characterId: held.characterId,
				status: 'has-ability'
			});
		}
	}
	return out;
}

/**
 * Adds a step for each gained ability, right after the gained character's own step, with
 * that character's night text. A character not in play (the Boffin's) has no step of its
 * own, so its step goes where `order` (the night sheet's ids for tonight) puts it; with no
 * place there, just before Dawn. A gained
 * ability with no night text adds nothing. The step keeps the gaining character (the Pixie) as
 * its character, with `gained` saying whose ability it is and whether it is still `if-mad`.
 */
export function withGainedSteps<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup,
	night: Night,
	order: readonly string[] = []
): (T | NightStep)[] {
	const out: (T | NightStep)[] = [...steps];
	// Before the first step the sheet puts after `id`.
	const bySheet = (id: string) => {
		const at = order.indexOf(id);
		if (at < 0) return -1;
		return out.findIndex((s) => order.indexOf(s.id) > at);
	};
	for (const gained of gainedAbilities(game, characters)) {
		// The step is the holder's own token's: the Pixie's, or the Demon holding the Boffin's.
		const token = game.seats[gained.seatId]?.characterId;
		const by = token ?? gained.via;
		const via = by === undefined ? undefined : characters.get(by);
		const as: Character | undefined = characters.get(gained.characterId);
		if (!via || !as) continue;
		const own = night === 'first' ? as.firstNightReminder : as.otherNightReminder;
		const first = night === 'other' ? as.firstNightReminder : undefined;
		// A jinx may wake them to learn the ability though it has no night text (the Cannibal's
		// Zealot): the step says so in our words.
		const learnsOnly =
			gained.learns === 'ability' && own === undefined && first === undefined
				? `Wake the ${via.name}: they learn they have the ${as.name} ability.`
				: undefined;
		const reminder = own ?? first ?? learnsOnly;
		if (reminder === undefined) continue;
		// A swapped token wakes at its own step when it has one tonight (the Philosopher as the
		// Dreamer); only a "you start knowing" ability gained later needs a step of its own.
		if (token === gained.characterId && own !== undefined) continue;
		const step: NightStep = {
			// Given by hand (no `via`): named for the Storyteller's call.
			id: `${gained.via ?? 'given'}@${gained.seatId}:${gained.characterId}`,
			kind: 'character',
			character: via,
			reminder,
			afterDawn: false,
			placement: 'night-sheet',
			notes: [],
			gained:
				own === undefined && first !== undefined ? { ...gained, firstNightText: true } : gained
		};
		const anchor = out.findIndex((s) => s.id === gained.characterId);
		const placed = anchor >= 0 ? anchor + 1 : bySheet(gained.characterId);
		const dawn = out.findIndex((s) => s.id === 'dawn');
		const at = placed >= 0 ? placed : dawn >= 0 ? dawn : out.length;
		out.splice(at, 0, step);
	}
	return out;
}

/**
 * The characters in play whose `givesAbility` goes to `seatId` (the Boffin's, while it is
 * the Demon; the seat's own, to `self` with nothing on the script to give: the Amnesiac's), so
 * its ⋯ menu offers to pick that ability.
 */
export function abilityGivers(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId[] {
	const givers = new Set<CharacterId>();
	for (const s of game.seating) {
		const id = trueCharacter(game, s, characters);
		const rule = id === undefined ? undefined : rulesOf(id, characters)?.givesAbility;
		if (!id || !rule) continue;
		if (rule.to === 'demon' && typeOf(game, seatId, characters) === 'demon') givers.add(id);
		if (rule.to === 'self' && !rule.onScript && s === seatId) givers.add(id);
	}
	return [...givers];
}

/**
 * The abilities `seatId`'s own character gives it from the script, by a `givesAbility` to
 * `self` with `onScript`: every other character of its types there (the Hermit's Outsiders).
 */
function ownHeld(game: Game, seatId: SeatId, characters: CharacterLookup): HeldAbility[] {
	const via = game.seats[seatId]?.characterId;
	const rule = via === undefined ? undefined : rulesOf(via, characters)?.givesAbility;
	if (via === undefined || rule?.to !== 'self' || !rule.onScript) return [];
	const types: readonly string[] = rule.types;
	return scriptCharacterIds(game.script)
		.filter((id) => id !== via && types.includes(characters.get(id)?.type ?? ''))
		.map((characterId) => ({ characterId, via }));
}

/** Every ability `seatId` holds without a token: picked for it, then its own. */
function allHeld(game: Game, seatId: SeatId, characters: CharacterLookup): HeldAbility[] {
	return [...(game.seats[seatId]?.abilities ?? []), ...ownHeld(game, seatId, characters)];
}

/** The abilities `seatId` holds without a token, each with whether they have it now. */
export function heldAbilitiesOf(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): (HeldAbility & { works: boolean })[] {
	return allHeld(game, seatId, characters).map((held) => ({
		...held,
		works: holdsAbility(game, seatId, held, characters)
	}));
}

/**
 * Adds a step for each ability the Storyteller holds (the Plague Doctor's Minion), with that
 * Minion's night text: right after the Minion's own step when it is in play too, else where
 * `order` (the night sheet's ids for tonight) puts it, else just before Dawn. The Storyteller
 * makes its choices (the Plague Doctor's How to Run); it wakes nobody.
 */
export function withStorytellerSteps<T extends NightStep>(
	steps: readonly T[],
	game: Game,
	characters: CharacterLookup,
	night: Night,
	order: readonly string[] = []
): (T | NightStep)[] {
	const out: (T | NightStep)[] = [...steps];
	for (const held of game.storytellerAbilities ?? []) {
		const as = characters.get(held.characterId);
		const reminder = as && (night === 'first' ? as.firstNightReminder : as.otherNightReminder);
		if (!as || reminder === undefined) continue;
		const step: NightStep = {
			id: `storyteller:${held.via}:${held.characterId}`,
			kind: 'character',
			character: as,
			reminder,
			afterDawn: false,
			placement: 'night-sheet',
			notes: ['The Storyteller makes this choice; nobody wakes.'],
			storytellerAbility: held
		};
		const own = out.findIndex((s) => s.id === held.characterId);
		const at = order.indexOf(held.characterId);
		const later = at < 0 ? -1 : out.findIndex((s) => order.indexOf(s.id) > at);
		const dawn = out.findIndex((s) => s.id === 'dawn');
		const placed = own >= 0 ? own + 1 : later >= 0 ? later : dawn >= 0 ? dawn : out.length;
		out.splice(placed, 0, step);
	}
	return out;
}

/** One ability a player has (`abilitiesOfSeat`). */
export interface SeatAbility {
	characterId: CharacterId;
	/**
	 * How they have it: `own`, their true character; `token`, the token on their seat, by
	 * their own `gainsAbilityOf` or `swapsForAbility` (the Alchemist's Minion, the Apprentice's);
	 * `gained`, by their own `gainedFrom` once "Has Ability" (the Pixie, the Cannibal, the
	 * Philosopher); `held`, without a token while `holdsAbility` (the Boffin's, the Hermit's).
	 */
	how: 'own' | 'token' | 'gained' | 'held';
	/** The character that gives it to them, when it is not their own. */
	via?: CharacterId;
}

/**
 * Every ability `seatId`'s player has, their own first, each once. A gained or held ability is
 * the borrowed character's ability in full, used wherever that character's own is (Trevor,
 * 2026-11-03: the Alchemist and the Boffin simply take on the borrowed character's abilities).
 * A Drunk who thinks they are the Pixie gains nothing. Whether each works is `abilityState`'s
 * call, except a held one, listed only while it is held.
 */
export function abilitiesOfSeat(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): SeatAbility[] {
	const seat = game.seats[seatId];
	if (!seat) return [];
	const own = trueCharacter(game, seatId, characters);
	const out: SeatAbility[] = own === undefined ? [] : [{ characterId: own, how: 'own' }];
	const add = (a: SeatAbility) => {
		if (!out.some((o) => o.characterId === a.characterId)) out.push(a);
	};
	const token = seat.characterId;
	if (own !== undefined && token !== undefined && token !== own) {
		const type = characters.get(token)?.type;
		const gains = rulesOf(own, characters)?.gainsAbilityOf;
		if (
			(gains !== undefined && gains === type) ||
			swappedIn(game, seatId, own, characters) === token
		)
			add({ characterId: token, how: 'token', via: own });
	}
	const via = gainingCharacter(game, seatId, characters);
	const rule = via === undefined ? undefined : rulesOf(via, characters)?.gainedFrom;
	if (via !== undefined && via === own && rule) {
		const gained = gainedBy(game, seatId, via, rule, characters);
		if (gained?.status === 'has-ability')
			add({ characterId: gained.characterId, how: 'gained', via });
	}
	for (const held of allHeld(game, seatId, characters))
		if (holdsAbility(game, seatId, held, characters))
			add({
				characterId: held.characterId,
				how: 'held',
				...(held.via !== undefined ? { via: held.via } : {})
			});
	return out;
}

/**
 * Every player who has `characterId`'s ability (`abilitiesOfSeat`), living or dead, in seating
 * order: its own players, and those who gained or hold it. A rule that asks who uses an
 * ability reads this, not the true character or the token alone.
 */
export function abilityHolders(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): SeatId[] {
	return game.seating.filter((id) =>
		abilitiesOfSeat(game, id, characters).some((a) => a.characterId === characterId)
	);
}

/** How `seatId` has `characterId`'s ability (`abilitiesOfSeat`), if they do. */
export function abilityOf(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): SeatAbility | undefined {
	return abilitiesOfSeat(game, seatId, characters).find((a) => a.characterId === characterId);
}

/**
 * Whether `seatId` has `characterId`'s ability working now (`abilitiesOfSeat`): their own, by
 * their token (the Apprentice stays the Apprentice but "gains the ability of their character
 * token", https://wiki.bloodontheclocktower.com/Apprentice; the Alchemist's Minion) or gained
 * (the Pixie's), while their own ability works, or once they are dead and not drunk or
 * poisoned, while it is one they keep (`keptWhenDead`: the dead Cannibal's Recluse); or held
 * (the Hermit's Mutant, https://wiki.bloodontheclocktower.com/Hermit), while it is held.
 */
export function hasAbilityOf(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): boolean {
	const ability = abilityOf(game, seatId, characterId, characters);
	if (!ability) return false;
	if (ability.how === 'held') return true;
	const state = abilityState(game, seatId, characters);
	if (state.works) return true;
	return (
		ability.how !== 'own' &&
		state.dead &&
		state.impairments.length === 0 &&
		keptWhenDead(characterId, characters)
	);
}

/**
 * The token a `swapsForAbility` character's player was swapped to, of a type its rule allows
 * for their alignment: the ability they gained (the Apprentice's Townsfolk or Minion).
 */
function swappedIn(
	game: Game,
	seatId: SeatId,
	own: CharacterId | undefined,
	characters: CharacterLookup
): CharacterId | undefined {
	const rule = own === undefined ? undefined : rulesOf(own, characters)?.swapsForAbility;
	const seat = game.seats[seatId];
	const token = seat?.characterId;
	if (!rule || token === undefined || token === own) return undefined;
	if (!seat.reminders.some((r) => r.characterId === own && r.label === rule.token))
		return undefined;
	const type = characters.get(token)?.type;
	const types: readonly string[] =
		seat.alignment === 'evil'
			? rule.evil
			: seat.alignment === 'good'
				? rule.good
				: [...rule.good, ...rule.evil];
	return type !== undefined && types.includes(type) ? token : undefined;
}

/**
 * The characters whose ability a player has by their own `gainsAbilityOf` (the Alchemist's
 * Minion, https://wiki.bloodontheclocktower.com/Alchemist): the token their seat shows, of that
 * type, while they are really another character. Also an ability they hold from a character
 * whose `givesAbility` makes its `setup` change (the Boffin's good ability on the Demon,
 * https://wiki.bloodontheclocktower.com/Boffin), made at setup whether or not it works later.
 * Their setup changes apply (`analyseSetup`'s `abilities`). Only `seatIds`' players, all by
 * default.
 */
export function gainedSetupAbilities(
	game: Game,
	characters: CharacterLookup,
	seatIds: readonly SeatId[] = game.seating
): Character[] {
	return seatIds.flatMap((seatId) => {
		const shown = characters.get(game.seats[seatId]?.characterId ?? '');
		const own = trueCharacter(game, seatId, characters);
		const type = own === undefined ? undefined : rulesOf(own, characters)?.gainsAbilityOf;
		// Or the character they think they are, by a jinx (`thinksPartnerSetup`: the Marionette
		// who thinks they are the Balloonist, https://wiki.bloodontheclocktower.com/Marionette#Related_Jinxes).
		const thinks = thinksPartnerSetup(game, seatId, characters) !== undefined;
		const gained = shown && own !== shown.id && (type === shown.type || thinks) ? [shown] : [];
		const held = (game.seats[seatId]?.abilities ?? []).flatMap((h) => {
			const character = characters.get(h.characterId);
			const setup = h.via !== undefined && rulesOf(h.via, characters)?.givesAbility?.setup;
			return character && setup ? [character] : [];
		});
		return [...gained, ...held];
	});
}
