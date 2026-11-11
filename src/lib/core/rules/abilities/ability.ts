/**
 * Whether a player's ability works, and if not, why and because of whom. Everything that
 * reasons about drunk, poisoned or "no ability" players (pre-day reminders, night info,
 * the Mathematician, death checks) asks `abilityState`.
 *
 * Drunk and poisoned have the same effect on an ability: the Glossary defines both as
 * "has no ability but thinks they do, and the Storyteller acts like they do", and lists
 * "dead, drunk, or poisoned" as the ways a character has no ability
 * (https://wiki.bloodontheclocktower.com/Glossary). So the rules here treat them alike;
 * which one it is, and its source, is only a label for the Storyteller.
 *
 * Tokens are the source of truth: a Poisoned token means poisoned until the Storyteller
 * removes it. The exceptions are effects whose own wiki page ties them to another
 * character's state (the Preacher's No Ability and the Pukka's Poisoned, below).
 *
 * Everything here is a suggestion: the Storyteller can override any of it.
 */
import {
	ALIGNMENTS,
	SEATED_TYPES,
	type Alignment,
	type CharacterId,
	type CharacterType,
	type ReminderLabel
} from '#lib/core/data/types.ts';
import type { ImpairmentReason, TokenImpairment } from '#lib/core/data/character-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import { isOnScript, type CharacterLookup } from '#lib/core/model/characters.ts';
import {
	alignmentOf,
	getSeat,
	isTraveller,
	nearestOfType,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import type { Game, ReminderId, SeatId } from '#lib/core/model/types.ts';
import { keepsAbilityWhenDead } from './dead-characters.ts';
import { abilitiesOfSeat, hasAbilityOf } from './gained-abilities.ts';
import { jinxImpairs, ownJinxRules, registeredTo } from '#lib/core/rules/jinxes/jinxes.ts';
import { jinxApplies } from '#lib/core/rules/jinxes/jinx-when.ts';
import {
	bothDrunkPair,
	gainedAbilityTaken,
	survivesCarrierBy
} from '#lib/core/rules/jinxes/jinx-effects.ts';
import { protectors } from './protection.ts';
import { effectImpairment } from '#lib/core/rules/reminders/reminder-effects.ts';
import { drunkByWish } from './wishes.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

const W = 'https://wiki.bloodontheclocktower.com/';

/** The character (and seat, when one holds it) whose ability causes an effect. */
export interface AbilitySource {
	characterId: CharacterId;
	seatId?: SeatId;
	/** The reminder token that records it, when there is one. */
	reminderId?: ReminderId;
}

export interface Impairment {
	reason: ImpairmentReason;
	source: AbilitySource;
	wiki: string;
}

export interface AbilityState {
	seatId: SeatId;
	/** The player's true character (the Drunk, not the Townsfolk they were shown). */
	characterId?: CharacterId;
	/** True when the ability works: not drunk, poisoned or without ability, and alive (or it works even if dead). */
	works: boolean;
	/**
	 * Dead players have no ability, unless it says "even if dead" or another character's token
	 * keeps it (`keepsAbility`, the Vigormortis's Has Ability).
	 */
	dead: boolean;
	/** Every reason it does not work, `no-ability` first, then poisoned, then drunk. */
	impairments: Impairment[];
}

/** "poisoned" or "drunk" when a reminder token's label says so ("Poisoned", "Drunk 2"). */
export function impairmentOfLabel(label: string): 'poisoned' | 'drunk' | undefined {
	if (/\bpoisoned\b/i.test(label)) return 'poisoned';
	if (/\bdrunk\b/i.test(label)) return 'drunk';
	return undefined;
}

/** What a reminder token does to its carrier or the other players (`impairs.tokens`). */
function tokenImpairment(
	game: Game,
	r: { characterId: CharacterId; label: ReminderLabel },
	characters: CharacterLookup
): TokenImpairment | undefined {
	return rulesFor(game, r.characterId, characters)?.impairs?.tokens?.[r.label];
}

/** The character's wiki page, or the Glossary for a homebrew character. */
function wikiOf(characterId: CharacterId, characters: CharacterLookup): string {
	const character = characters.get(characterId);
	return (character && wikiUrl(character)) ?? `${W}Glossary`;
}

/** An impairment from `source`, linked to its character's wiki page. */
function sourced(reason: ImpairmentReason, source: AbilitySource, characters: CharacterLookup) {
	return { reason, source, wiki: wikiOf(source.characterId, characters) };
}

const ORDER: Record<ImpairmentReason, number> = { 'no-ability': 0, poisoned: 1, drunk: 2 };

/** The first seat whose true character is `characterId`, other than `not`. */
export function seatOfCharacter(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup,
	not?: SeatId
): SeatId | undefined {
	return game.seating.find((s) => s !== not && trueCharacter(game, s, characters) === characterId);
}

/** Abilities that say they work "even if dead" (the Recluse, the Spy). */
export function worksWhenDead(characterId: CharacterId | undefined, characters: CharacterLookup) {
	const ability = characterId ? characters.get(characterId)?.ability : undefined;
	return ability !== undefined && /\beven if dead\b/i.test(ability);
}

/**
 * Whether the character whose token sits on `carrier` still has a working ability: some other
 * player of it works, or none is in play (a token left by a gained ability, which we can't
 * trace).
 */
function sourceWorks(
	game: Game,
	carrier: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	visiting: Set<SeatId>
): boolean {
	const seats = game.seating.filter(
		(s) => s !== carrier && trueCharacter(game, s, characters) === characterId
	);
	return (
		seats.length === 0 ||
		seats.some((s) => !visiting.has(s) && abilityWorks(game, s, characters, visiting))
	);
}

/**
 * Whether anyone has `characterId`'s ability now: a player who is that character, living or
 * dead (their true character or their token, as the Philosopher's or Alchemist's swapped
 * token), a player who holds it without a token (`Seat.abilities`, the Boffin's; or their own
 * `givesAbility` from the script, the Hermit's), the Storyteller (the Plague Doctor's), or it
 * is a Fabled or Loric in play. Once nobody has it, its "Poisoned" and "Drunk" tokens do
 * nothing: a Poisoner who becomes the Imp no longer poisons anyone
 * (https://wiki.bloodontheclocktower.com/Poisoner, Example 5).
 */
function abilityInPlay(game: Game, characterId: CharacterId, characters: CharacterLookup): boolean {
	if (game.ruleCharacters.includes(characterId)) return true;
	if (game.storytellerAbilities?.some((a) => a.characterId === characterId)) return true;
	const type = characters.get(characterId)?.type ?? '';
	return game.seating.some((s) => {
		const seat = game.seats[s];
		if (seat.characterId === characterId) return true;
		if (trueCharacter(game, s, characters) === characterId) return true;
		if (seat.abilities?.some((a) => a.characterId === characterId)) return true;
		const gives = seat.characterId
			? rulesFor(game, seat.characterId, characters)?.givesAbility
			: undefined;
		return (
			gives?.to === 'self' &&
			gives.onScript === true &&
			(gives.types as readonly string[]).includes(type) &&
			isOnScript(game.script, characterId)
		);
	});
}

/**
 * Whether a jinx keeps `by`'s `impairs` tokens off `characterId`'s player
 * (`partnerKeepsAbility`: the Minstrel's and the Preacher's Legion keeps their ability,
 * https://wiki.bloodontheclocktower.com/Legion#Related_Jinxes).
 */
export function sparedByJinx(
	game: Game,
	by: CharacterId,
	characterId: CharacterId | undefined,
	characters: CharacterLookup
): boolean {
	if (characterId === undefined) return false;
	const effect = ownJinxRules(game, by, characterId, characters)?.partnerKeepsAbility;
	return effect !== undefined && jinxApplies(game, by, characterId, effect, characters);
}

function impairmentsOf(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	visiting: Set<SeatId>
): Impairment[] {
	const seat = getSeat(game, seatId);
	if (!seat) return [];
	const out: Impairment[] = [];
	const characterId = trueCharacter(game, seatId, characters);

	for (const r of seat.reminders) {
		// An effect the Storyteller picked for the token (the Angel's Something Bad: poisoned, or
		// no ability for a day, https://wiki.bloodontheclocktower.com/Angel).
		const picked = effectImpairment(r.effect, game);
		if (picked) {
			out.push(
				sourced(picked, { characterId: r.characterId, reminderId: r.reminderId }, characters)
			);
			continue;
		}
		const rule = tokenImpairment(game, r, characters);
		if (rule?.on === 'others') continue;
		if (rule && sparedByJinx(game, r.characterId, characterId, characters)) continue;
		if (rule) {
			// A token that impairs its carrier only while its character's ability works (the
			// Preacher's: https://wiki.bloodontheclocktower.com/Preacher; the Pukka's, whose
			// marked player is unaffected while the Pukka is drunk, poisoned, dead or no longer
			// the Pukka: https://wiki.bloodontheclocktower.com/Pukka), and only a `type`
			// carrier. Otherwise it does nothing.
			if (rule.type && typeOf(game, seatId, characters) !== rule.type) continue;
			const source = rule.whileWorks
				? game.seating.find(
						(s) =>
							s !== seatId &&
							trueCharacter(game, s, characters) === r.characterId &&
							!visiting.has(s) &&
							abilityWorks(game, s, characters, visiting)
					)
				: seatOfCharacter(game, r.characterId, characters, seatId);
			if (rule.whileWorks && !source) continue;
			if (
				rule.whileKept &&
				!keptSourceHolds(game, seatId, r.characterId, rule.whileKept, characters, visiting)
			)
				continue;
			const at = { characterId: r.characterId, reminderId: r.reminderId };
			out.push(sourced(rule.reason, source ? { ...at, seatId: source } : at, characters));
			continue;
		}
		const reason = impairmentOfLabel(r.label);
		if (!reason) continue;
		// Another character's "Poisoned" or "Drunk" lasts only while that character's ability
		// works: once its player dies, is drunk or poisoned, the effect ends at once
		// (https://wiki.bloodontheclocktower.com/Abilities, the dead Poisoner's Slayer), and so
		// it does once nobody has that ability, as when the Poisoner becomes the Imp
		// (https://wiki.bloodontheclocktower.com/Poisoner, Example 5). Tokens that last
		// regardless say so with an `impairs.tokens` entry (the Sweetheart's). A token whose
		// ability someone holds without being that character (a gained ability) is kept.
		if (
			r.characterId !== characterId &&
			(!abilityInPlay(game, r.characterId, characters) ||
				!sourceWorks(game, seatId, r.characterId, characters, visiting))
		)
			continue;
		const sourceSeat =
			r.characterId === characterId
				? seatId
				: seatOfCharacter(game, r.characterId, characters, seatId);
		out.push({
			reason,
			source: {
				characterId: r.characterId,
				...(sourceSeat ? { seatId: sourceSeat } : {}),
				reminderId: r.reminderId
			},
			wiki: `${W}Glossary`
		});
	}

	// Its own player is impaired: always (the Drunk, whether or not an "Is The Drunk" token
	// says so: https://wiki.bloodontheclocktower.com/Drunk), or once few enough players live
	// (the Witch: https://wiki.bloodontheclocktower.com/Witch).
	const self = characterId ? rulesOf(characterId, characters)?.impairs?.self : undefined;
	if (characterId && self) {
		const alive = game.seating.filter((s) => !game.seats[s].dead).length;
		const applies =
			self.aliveAtMost !== undefined
				? alive <= self.aliveAtMost
				: !out.some((i) => i.source.characterId === characterId);
		if (applies) {
			out.push(sourced(self.reason, { characterId, seatId }, characters));
		}
	}

	// A jinx impairs this one whatever its own ability's state, while its `when` holds
	// (`impairs`: with `partner-in-play`, the Spy or the Widow, alive or dead, poisons the
	// Damsel, https://wiki.bloodontheclocktower.com/Damsel#Related_Jinxes). The jinx also covers
	// one that has been in play; the game keeps no record of a character that left play, so
	// only one in play now counts. One about the ability they have from their token is below.
	if (characterId) {
		for (const { partner, kind } of jinxImpairs(game, characterId, characters)) {
			const source = seatOfCharacter(game, partner, characters, seatId);
			const at = source ? { characterId: partner, seatId: source } : { characterId: partner };
			out.push(sourced(kind, at, characters));
		}
	}

	// A jinx takes away the ability they have from their token (`impairs` with
	// `has-partner-ability`: the Alchemist-Spy has no Spy ability,
	// https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes), or leaves them alive with
	// none once their host was executed (`survives` `carrier-executed`: the Lleech with the
	// Mastermind, https://wiki.bloodontheclocktower.com/Lleech#Related_Jinxes).
	const taken = gainedAbilityTaken(game, seatId, characters);
	if (taken) out.push(sourced(taken.kind, { characterId: taken.partner }, characters));
	const survivedBy = survivesCarrierBy(game, seatId, characters);
	if (survivedBy) out.push(sourced('no-ability', { characterId: survivedBy }, characters));

	// A token that impairs every other player but Travellers while it is on the board (the
	// Minstrel's "Everyone Is Drunk": https://wiki.bloodontheclocktower.com/Minstrel), or only
	// `type` players while its character's ability works (the Xaan's "X", every Townsfolk:
	// https://wiki.bloodontheclocktower.com/Xaan).
	const traveller = isTraveller(game, seatId, characters);
	others: for (const other of traveller ? [] : game.seating) {
		if (other === seatId) continue;
		for (const token of game.seats[other].reminders) {
			const rule = tokenImpairment(game, token, characters);
			if (rule?.on !== 'others') continue;
			if (sparedByJinx(game, token.characterId, characterId, characters)) continue;
			if (rule.type && typeOf(game, seatId, characters) !== rule.type) continue;
			const source = seatOfCharacter(game, token.characterId, characters) ?? other;
			if (source === seatId) continue;
			if (
				rule.whileWorks &&
				(visiting.has(source) || !abilityWorks(game, source, characters, visiting))
			)
				continue;
			const at = { characterId: token.characterId, seatId: source, reminderId: token.reminderId };
			out.push(sourced(rule.reason, at, characters));
			break others;
		}
	}

	// A granted wish making every good player drunk (the Wizard's, wishes.ts).
	const wish = drunkByWish(game, seatId);
	if (wish) out.push(sourced('drunk', wish, characters));

	// A player safe from the Demon (`protects.from: demon`: the Monk's Safe, the Soldier) is
	// safe from every harmful effect of the Demon's ability, its poisoning too, not only its kill
	// (How to Run: https://wiki.bloodontheclocktower.com/Monk, /Soldier).
	const fromDemon = (i: Impairment) =>
		i.source.reminderId !== undefined && characters.get(i.source.characterId)?.type === 'demon';
	const unharmed = out.some(fromDemon) ? out.filter((i) => !fromDemon(i)) : out;
	const safe =
		unharmed !== out && safeFromDemon(game, seatId, characters, visiting, unharmed.length === 0);

	// A token that makes its carrier sober and healthy while its character's ability works
	// (the Barista's "Sober & Healthy": https://wiki.bloodontheclocktower.com/Barista). An
	// ability that is removed outright (`no-ability`) stays removed.
	const sober = seat.reminders.some(
		(r) =>
			rulesFor(game, r.characterId, characters)?.impairs?.clears?.includes(r.label) &&
			sourceWorks(game, seatId, r.characterId, characters, visiting)
	);
	const left = safe ? unharmed : out;
	const kept = sober ? left.filter((i) => i.reason === 'no-ability') : left;
	// Both drunk while both are sober (`impairs` with `who: "both"` and `unlessImpaired`: the
	// Alchemist with the Organ Grinder ability and the Organ Grinder,
	// https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes).
	const pair = kept.length === 0 ? bothDrunkPair(game, seatId, characters) : undefined;
	if (pair && !visiting.has(pair.other)) {
		const next = new Set(visiting).add(seatId);
		if (impairmentsOf(game, pair.other, characters, next).length === 0)
			kept.push(sourced(pair.kind, { characterId: pair.partner }, characters));
	}
	return kept.sort((a, b) => ORDER[a.reason] - ORDER[b.reason]);
}

/**
 * Whether a working protection from the Demon alone (`protects.from: demon`) covers `seatId`:
 * its own, while nothing but the Demon impairs it (`selfWorks`), or another player's whose
 * ability works.
 */
function safeFromDemon(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	visiting: Set<SeatId>,
	selfWorks: boolean
): boolean {
	return protectors(game, seatId, characters, 'demon').some(({ source, from }) => {
		if (from !== 'demon') return false;
		if (source.seatId === undefined) return true;
		if (source.seatId === seatId) return selfWorks;
		return !visiting.has(source.seatId) && abilityWorks(game, source.seatId, characters, visiting);
	});
}

function abilityWorks(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	visiting: Set<SeatId>
): boolean {
	const seat = getSeat(game, seatId);
	if (!seat) return false;
	const next = new Set(visiting).add(seatId);
	if (impairmentsOf(game, seatId, characters, next).length > 0) return false;
	return (
		!seat.dead ||
		worksWhenDead(trueCharacter(game, seatId, characters), characters) ||
		keepsAbility(game, seatId, characters, next)
	);
}

/**
 * Whether a dead player keeps their ability by another character's token (`keepsAbility`),
 * only while that character's ability works: a dead, drunk or poisoned Vigormortis's Minions
 * lose theirs (https://wiki.bloodontheclocktower.com/Vigormortis, M15g).
 */
function keepsAbility(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	visiting: Set<SeatId>
): boolean {
	return keepsAbilityWhenDead(
		game,
		seatId,
		characters,
		(s) => !visiting.has(s) && abilityWorks(game, s, characters, visiting)
	);
}

/**
 * Whether a token with `whileKept` still impairs `carrier`: some seat carrying its character's
 * `whileKept.token` keeps their ability (`keepsAbility`), and, with `nearest`, the carrier is
 * that seat's nearest player of that type either way round (the Vigormortis's Poisoned
 * Townsfolk beside a Minion it killed, healthy again once that Minion loses their ability or
 * is no longer a Minion: https://wiki.bloodontheclocktower.com/Vigormortis, M15g).
 */
function keptSourceHolds(
	game: Game,
	carrier: SeatId,
	characterId: CharacterId,
	whileKept: NonNullable<TokenImpairment['whileKept']>,
	characters: CharacterLookup,
	visiting: Set<SeatId>
): boolean {
	return game.seating.some((s) => {
		if (s === carrier) return false;
		if (
			!game.seats[s].reminders.some(
				(r) => r.characterId === characterId && r.label === whileKept.token
			)
		)
			return false;
		if (!keepsAbility(game, s, characters, visiting)) return false;
		if (!whileKept.nearest) return true;
		const near = nearestOfType(game, s, whileKept.nearest, characters);
		return near.anticlockwise === carrier || near.clockwise === carrier;
	});
}

/** Whether a seat's ability works, and if not, every reason with its source. */
export function abilityState(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): AbilityState {
	const seat = getSeat(game, seatId);
	const characterId = trueCharacter(game, seatId, characters);
	const impairments = seat ? impairmentsOf(game, seatId, characters, new Set([seatId])) : [];
	const dead =
		(seat?.dead ?? false) &&
		!worksWhenDead(characterId, characters) &&
		!keepsAbility(game, seatId, characters, new Set([seatId]));
	return {
		seatId,
		...(characterId !== undefined ? { characterId } : {}),
		works: seat !== undefined && impairments.length === 0 && !dead,
		dead,
		impairments
	};
}

/**
 * The character whose working reminder on `seatId` means its player always gets true
 * information (`impairs.truthful`: the Barista's "Sober & Healthy", even under the Vortox,
 * https://wiki.bloodontheclocktower.com/Barista). Undefined when there is none.
 */
export function truthfulBy(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId | undefined {
	const seat = getSeat(game, seatId);
	return seat?.reminders.find(
		(r) =>
			rulesFor(game, r.characterId, characters)?.impairs?.truthful?.includes(r.label) &&
			sourceWorks(game, seatId, r.characterId, characters, new Set([seatId]))
	)?.characterId;
}

// ── Registration ────────────────────────────────────────────────────────────

/**
 * A player who may register as another alignment or character type, by their own or
 * another character's ability. The first alignment and type are the true ones, except
 * where registration is fixed (the Lycanthrope's Faux Paw player always registers evil).
 */
export interface Registration {
	seatId: SeatId;
	alignments: Alignment[];
	types: CharacterType[];
	source: AbilitySource;
	wiki: string;
}

/**
 * Players whose registration is the Storyteller's choice, or fixed by an ability, as each
 * character's `registersAs` rules say:
 * - the Recluse might register as evil and as a Minion or Demon, even if dead
 *   (https://wiki.bloodontheclocktower.com/Recluse);
 * - the Spy might register as good and as a Townsfolk or Outsider, even if dead
 *   (https://wiki.bloodontheclocktower.com/Spy);
 * - the Lycanthrope's Faux Paw player is good but registers as evil
 *   (https://wiki.bloodontheclocktower.com/Lycanthrope);
 * - the Revolutionary's two "Aligned" players might register as anything while "Register
 *   Falsely?" is still in play: once it has been used, it comes off
 *   (https://wiki.bloodontheclocktower.com/Revolutionary).
 * A drunk or poisoned Recluse or Spy registers truly: they have no ability.
 * A player holding such an ability registers by it too (the Hermit with the Recluse's,
 * https://wiki.bloodontheclocktower.com/Hermit).
 *
 * With `viewer`, the character whose ability is asking, a jinx with it may change how a
 * player registers (`registersTo`, whatever that player's own ability's state): the
 * Politician might register as evil to Legion
 * (https://wiki.bloodontheclocktower.com/Politician#Related_Jinxes), the Summoner registers as
 * the Demon to the Clockmaker (https://wiki.bloodontheclocktower.com/Summoner#Related_Jinxes).
 */
export function registrations(
	game: Game,
	characters: CharacterLookup,
	viewer?: CharacterId
): Registration[] {
	const out: Registration[] = [];
	for (const seatId of game.seating) {
		const own = ownRegistration(game, seatId, characters);
		const id = trueCharacter(game, seatId, characters);
		const jinx = viewer && id ? ownJinxRules(game, id, viewer, characters)?.registersTo : undefined;
		// Its `when` is about this player (a third character in play, M44).
		const rule =
			jinx && jinxApplies(game, id!, viewer!, jinx, characters, { seatId }) ? jinx : undefined;
		const alignment = alignmentOf(game, seatId);
		const type = typeOf(game, seatId, characters);
		if (!rule || !id || !alignment || !type) {
			if (own) out.push(own);
			continue;
		}
		const to = registeredTo(own ?? { alignments: [alignment], types: [type] }, rule);
		// Registering only as they truly are is no registration at all.
		const truly = (list: readonly string[], value: string) =>
			list.length === 1 && list[0] === value;
		if (truly(to.alignments, alignment) && truly(to.types, type)) continue;
		out.push({
			seatId,
			...to,
			source: own?.source ?? { characterId: id, seatId },
			wiki: own?.wiki ?? wikiOf(id, characters)
		});
	}
	return out;
}

/** How one player may register to everyone, by their own or another character's ability. */
function ownRegistration(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): Registration | undefined {
	const id = trueCharacter(game, seatId, characters);
	const alignment = alignmentOf(game, seatId);
	const type = typeOf(game, seatId, characters);
	if (!alignment || !type) return undefined;
	// Their own character's, else another ability they have: held (the Hermit's Recluse) or
	// gained (the Cannibal who ate the Recluse, https://wiki.bloodontheclocktower.com/Cannibal).
	const mine = id ? rulesFor(game, id, characters)?.registersAs?.self : undefined;
	const by =
		id && mine && abilityState(game, seatId, characters).works
			? id
			: abilitiesOfSeat(game, seatId, characters).find(
					(a) =>
						a.how !== 'own' &&
						rulesFor(game, a.characterId, characters)?.registersAs?.self &&
						hasAbilityOf(game, seatId, a.characterId, characters)
				)?.characterId;
	const self = by ? rulesFor(game, by, characters)?.registersAs?.self : undefined;
	if (by && self) {
		return {
			seatId,
			alignments: [alignment, ...(self.alignments ?? [])].filter(
				(a, i, all): a is Alignment => all.indexOf(a) === i
			),
			types: [type, ...(self.types ?? [])].filter(
				(t, i, all): t is CharacterType => all.indexOf(t) === i
			),
			source: { characterId: by, seatId },
			wiki: wikiOf(by, characters)
		};
	}
	for (const token of game.seats[seatId].reminders) {
		const rule = rulesFor(game, token.characterId, characters)?.registersAs?.tokens?.[token.label];
		if (!rule || (rule.carrierAlignment && rule.carrierAlignment !== alignment)) continue;
		if (rule.whileToken && !inPlayToken(game, token.characterId, rule.whileToken)) continue;
		const source = game.seating.find(
			(s) =>
				trueCharacter(game, s, characters) === token.characterId &&
				abilityState(game, s, characters).works
		);
		// A Fabled has no seat: its tokens work while it is in play.
		if (!source && !game.ruleCharacters.includes(token.characterId)) continue;
		const fixed = rule.asAnything
			? { alignments: [alignment, ...ALIGNMENTS], types: [type, ...SEATED_TYPES] }
			: { alignments: rule.alignments ?? [alignment], types: rule.types ?? [type] };
		return {
			seatId,
			alignments: fixed.alignments.filter((a, i, all): a is Alignment => all.indexOf(a) === i),
			types: fixed.types.filter((t, i, all): t is CharacterType => all.indexOf(t) === i),
			source: {
				characterId: token.characterId,
				...(source ? { seatId: source } : {}),
				reminderId: token.reminderId
			},
			wiki: wikiOf(token.characterId, characters)
		};
	}
	return undefined;
}

/** Whether `characterId`'s reminder `label` is on any seat. */
function inPlayToken(game: Game, characterId: CharacterId, label: string): boolean {
	return game.seating.some((s) =>
		game.seats[s].reminders.some((r) => r.characterId === characterId && r.label === label)
	);
}

/** How every player registers in one possible world. */
export interface RegistrationWorld {
	alignment: (seatId: SeatId) => Alignment | undefined;
	type: (seatId: SeatId) => CharacterType | undefined;
	/**
	 * Seats registering as something other than their true alignment or type here, and
	 * players whose alignment is not set yet (a Traveller's) when this world gives it one.
	 */
	misregistered: SeatId[];
}

/** At most this many worlds are enumerated; beyond it, the rest are not considered. */
const MAX_WORLDS = 4096;

/**
 * Every way the players may register. The first world is the default: everyone as they
 * truly are, apart from fixed registrations (Faux Paw), so it gives the true answer.
 *
 * A player with a character but no alignment yet (a Traveller whose alignment the
 * Storyteller has not chosen, https://wiki.bloodontheclocktower.com/Travellers) is
 * unknown: no alignment in the default world, then good and evil in the others, where they
 * count as `misregistered` so answers that depend on them are marked.
 */
export function registrationWorlds(
	game: Game,
	characters: CharacterLookup,
	regs: readonly Registration[] = registrations(game, characters)
): RegistrationWorld[] {
	type Choice = { seatId: SeatId; alignment?: Alignment; type: CharacterType };
	const unset: Registration[] = game.seating.flatMap((seatId) => {
		const type = typeOf(game, seatId, characters);
		const id = trueCharacter(game, seatId, characters);
		if (alignmentOf(game, seatId) !== undefined || !type || !id) return [];
		return [
			{
				seatId,
				alignments: ['good', 'evil'],
				types: [type],
				source: { characterId: id, seatId },
				wiki: `${W}Travellers`
			}
		];
	});
	let combos: Choice[][] = [[]];
	for (const reg of [...regs, ...unset]) {
		const options: (Alignment | undefined)[] = unset.includes(reg)
			? [undefined, ...reg.alignments]
			: reg.alignments;
		const next: Choice[][] = [];
		for (const combo of combos) {
			for (const alignment of options) {
				for (const type of reg.types) {
					if (next.length < MAX_WORLDS)
						next.push([
							...combo,
							{ seatId: reg.seatId, ...(alignment ? { alignment } : {}), type }
						]);
				}
			}
		}
		combos = next;
	}
	return combos.map((combo) => {
		const bySeat = new Map(combo.map((c) => [c.seatId, c]));
		return {
			alignment: (s) => bySeat.get(s)?.alignment ?? alignmentOf(game, s),
			type: (s) => bySeat.get(s)?.type ?? typeOf(game, s, characters),
			misregistered: combo
				.filter(
					(c) =>
						c.alignment !== alignmentOf(game, c.seatId) ||
						c.type !== typeOf(game, c.seatId, characters)
				)
				.map((c) => c.seatId)
		};
	});
}
