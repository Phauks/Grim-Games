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
 * character's state (the Preacher, below).
 *
 * Everything here is a suggestion: the Storyteller can override any of it.
 */
import type { Alignment, CharacterId, CharacterType, ReminderLabel } from '#lib/core/data/types.ts';
import type { ImpairmentReason, TokenImpairment } from '#lib/core/data/character-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import {
	alignmentOf,
	getSeat,
	isTraveller,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import type { Game, ReminderId, SeatId } from '#lib/core/model/types.ts';

const W = 'https://wiki.bloodontheclocktower.com/';

export type { ImpairmentReason };

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
	/** Dead players have no ability, unless it says "even if dead". */
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
	r: { characterId: CharacterId; label: ReminderLabel },
	characters: CharacterLookup
): TokenImpairment | undefined {
	return rulesOf(r.characterId, characters)?.impairs?.tokens?.[r.label];
}

/** The character's wiki page, or the Glossary for a homebrew character. */
function wikiOf(characterId: CharacterId, characters: CharacterLookup): string {
	const character = characters.get(characterId);
	return (character && wikiUrl(character)) ?? `${W}Glossary`;
}

const ORDER: Record<ImpairmentReason, number> = { 'no-ability': 0, poisoned: 1, drunk: 2 };

/** The first seat whose true character is `characterId`, other than `not`. */
function seatOfCharacter(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup,
	not?: SeatId
): SeatId | undefined {
	return game.seating.find((s) => s !== not && trueCharacter(game, s, characters) === characterId);
}

/** Abilities that say they work "even if dead" (the Recluse, the Spy). */
function worksWhenDead(characterId: CharacterId | undefined, characters: CharacterLookup) {
	const ability = characterId ? characters.get(characterId)?.ability : undefined;
	return ability !== undefined && /\beven if dead\b/i.test(ability);
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
		const rule = tokenImpairment(r, characters);
		if (rule?.on === 'others') continue;
		if (rule) {
			// A token that impairs its carrier only while its character's ability works (the
			// Preacher's: https://wiki.bloodontheclocktower.com/Preacher), and only a `type`
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
			out.push({
				reason: rule.reason,
				source: {
					characterId: r.characterId,
					...(source ? { seatId: source } : {}),
					reminderId: r.reminderId
				},
				wiki: wikiOf(r.characterId, characters)
			});
			continue;
		}
		const reason = impairmentOfLabel(r.label);
		if (!reason) continue;
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
			out.push({
				reason: self.reason,
				source: { characterId, seatId },
				wiki: wikiOf(characterId, characters)
			});
		}
	}

	// A token that impairs every other player but Travellers while it is on the board (the
	// Minstrel's "Everyone Is Drunk": https://wiki.bloodontheclocktower.com/Minstrel).
	const traveller = isTraveller(game, seatId, characters);
	others: for (const other of traveller ? [] : game.seating) {
		if (other === seatId) continue;
		for (const token of game.seats[other].reminders) {
			const rule = tokenImpairment(token, characters);
			if (rule?.on !== 'others') continue;
			const source = seatOfCharacter(game, token.characterId, characters) ?? other;
			if (source === seatId) continue;
			out.push({
				reason: rule.reason,
				source: { characterId: token.characterId, seatId: source, reminderId: token.reminderId },
				wiki: wikiOf(token.characterId, characters)
			});
			break others;
		}
	}

	return out.sort((a, b) => ORDER[a.reason] - ORDER[b.reason]);
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
	return !seat.dead || worksWhenDead(trueCharacter(game, seatId, characters), characters);
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
	const dead = (seat?.dead ?? false) && !worksWhenDead(characterId, characters);
	return {
		seatId,
		...(characterId !== undefined ? { characterId } : {}),
		works: seat !== undefined && impairments.length === 0 && !dead,
		dead,
		impairments
	};
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
 *   (https://wiki.bloodontheclocktower.com/Lycanthrope).
 * A drunk or poisoned Recluse or Spy registers truly: they have no ability.
 */
export function registrations(game: Game, characters: CharacterLookup): Registration[] {
	const out: Registration[] = [];
	for (const seatId of game.seating) {
		const id = trueCharacter(game, seatId, characters);
		const alignment = alignmentOf(game, seatId);
		const type = typeOf(game, seatId, characters);
		if (!alignment || !type) continue;
		const self = id ? rulesOf(id, characters)?.registersAs?.self : undefined;
		if (id && self && abilityState(game, seatId, characters).works) {
			out.push({
				seatId,
				alignments: [alignment, ...(self.alignments ?? [])].filter(
					(a, i, all): a is Alignment => all.indexOf(a) === i
				),
				types: [type, ...(self.types ?? [])].filter(
					(t, i, all): t is CharacterType => all.indexOf(t) === i
				),
				source: { characterId: id, seatId },
				wiki: wikiOf(id, characters)
			});
			continue;
		}
		for (const token of game.seats[seatId].reminders) {
			const rule = rulesOf(token.characterId, characters)?.registersAs?.tokens?.[token.label];
			if (!rule || (rule.carrierAlignment && rule.carrierAlignment !== alignment)) continue;
			const source = game.seating.find(
				(s) =>
					trueCharacter(game, s, characters) === token.characterId &&
					abilityState(game, s, characters).works
			);
			if (!source) continue;
			out.push({
				seatId,
				alignments: (rule.alignments ?? [alignment]).filter(
					(a, i, all): a is Alignment => all.indexOf(a) === i
				),
				types: (rule.types ?? [type]).filter(
					(t, i, all): t is CharacterType => all.indexOf(t) === i
				),
				source: { characterId: token.characterId, seatId: source, reminderId: token.reminderId },
				wiki: wikiOf(token.characterId, characters)
			});
			break;
		}
	}
	return out;
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

// ── Protection ──────────────────────────────────────────────────────────────

/** One ability that protects a player from a kill, and the reminder that says so if any. */
export interface Protector {
	source: AbilitySource;
	/** Against the Demon's kill only, any death, or an execution only. */
	from: 'demon' | 'any' | 'execution';
}

/** What a death is from: the Demon's kill, another ability's, or the day's execution. */
export type DeathBy = 'demon' | 'other' | 'execution';

/**
 * Every ability that would stop `seatId` dying to a kill `by` the Demon or another ability,
 * in this order: its own (`protects.who: self`, the Sailor, the Soldier), then each reminder
 * on the seat whose character's rules say it protects the player it marks (the Tea Lady's
 * "Cannot Die", the Innkeeper's and Monk's "Safe", the Devil's Advocate's "Survives
 * Execution"). From the rules blocks (`protects`), so a custom character can protect too. An
 * execution is never stopped by a protection that lasts only the night (`night`). Whether
 * each ability works is the caller's to check.
 */
export function protectors(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	by: DeathBy
): Protector[] {
	const seat = getSeat(game, seatId);
	if (!seat) return [];
	const against = ({ from, night }: { from: Protector['from']; night?: true }) =>
		(from === 'any' || from === by) && !(night && by === 'execution');
	const out: Protector[] = [];
	const id = trueCharacter(game, seatId, characters);
	const own = id ? rulesOf(id, characters)?.protects : undefined;
	if (id && own?.who === 'self' && against(own)) {
		out.push({ source: { characterId: id, seatId }, from: own.from });
	}
	for (const r of seat.reminders) {
		const rule = rulesOf(r.characterId, characters)?.protects;
		if (rule?.who !== 'marked' || rule.token.toLowerCase() !== r.label.toLowerCase()) continue;
		if (!against(rule)) continue;
		const from = seatOfCharacter(game, r.characterId, characters);
		out.push({
			source: {
				characterId: r.characterId,
				...(from ? { seatId: from } : {}),
				reminderId: r.reminderId
			},
			from: rule.from
		});
	}
	return out;
}

/**
 * Why a player cannot die tonight, when the grimoire says so: the Storyteller's "can die"
 * override, else the first working ability from `protectors` (the Sailor, the Tea Lady, the
 * Innkeeper, and against the Demon only the Soldier and the Monk).
 * https://wiki.bloodontheclocktower.com/Sailor, /Tea_Lady, /Innkeeper, /Soldier, /Monk
 */
export function protection(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	by: DeathBy
): AbilitySource | 'override' | undefined {
	const seat = getSeat(game, seatId);
	if (!seat) return undefined;
	const override = seat.overrides.find((o) => o.field === 'canDie');
	if (override) return override.value ? undefined : 'override';
	const works = (s: SeatId) => abilityState(game, s, characters).works;
	return protectors(game, seatId, characters, by).find(
		(p) => !p.source.seatId || works(p.source.seatId)
	)?.source;
}

/**
 * The seat's own ability that may move a kill `by` the Demon or another ability onto another
 * player (`redirectsKill`, the Mayor against the Demon:
 * https://wiki.bloodontheclocktower.com/Mayor). Whether it works is the caller's to check.
 */
export function killRedirect(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	by: 'demon' | 'other'
): AbilitySource | undefined {
	const id = trueCharacter(game, seatId, characters);
	const rule = id ? rulesOf(id, characters)?.redirectsKill : undefined;
	if (!id || !rule || (rule.from === 'demon' && by !== 'demon')) return undefined;
	return { characterId: id, seatId };
}

/** An ability that stops its player's first death, and the token that marks it spent. */
export interface FirstDeathSaver {
	source: AbilitySource;
	spentToken: ReminderLabel;
}

/**
 * The seat's own ability that stops its first death (`survivesFirstDeath`, the Fool's), while
 * its spent token is not on the seat. Whether it works is the caller's to check.
 */
export function firstDeathSaver(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): FirstDeathSaver | undefined {
	const seat = getSeat(game, seatId);
	const id = trueCharacter(game, seatId, characters);
	const rule = id ? rulesOf(id, characters)?.survivesFirstDeath : undefined;
	if (!seat || !id || !rule) return undefined;
	const spent = rule.spentToken.toLowerCase();
	if (seat.reminders.some((r) => r.characterId === id && r.label.toLowerCase() === spent))
		return undefined;
	return { source: { characterId: id, seatId }, spentToken: rule.spentToken };
}
