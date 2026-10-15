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
import type { Alignment, CharacterId, CharacterType } from '#lib/core/data/types.ts';
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

/** Why an ability does not work. `no-ability`: an effect such as the Preacher's. */
export type ImpairmentReason = 'drunk' | 'poisoned' | 'no-ability';

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

/**
 * Reminder tokens whose label mentions drunk but that do not make their carrier drunk.
 * The Minstrel's "Everyone Is Drunk" makes every *other* player drunk except Travellers
 * (https://wiki.bloodontheclocktower.com/Minstrel); it is handled as a global effect.
 */
const GLOBAL_DRUNK = { characterId: 'minstrel', label: 'Everyone Is Drunk' } as const;

/** The Preacher's token on a chosen Minion (https://wiki.bloodontheclocktower.com/Preacher). */
export const PREACHED = { characterId: 'preacher', label: 'No Ability' } as const;

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
		if (r.characterId === GLOBAL_DRUNK.characterId && r.label === GLOBAL_DRUNK.label) continue;
		if (r.characterId === PREACHED.characterId && r.label === PREACHED.label) {
			// A chosen Minion has no ability while the Preacher lives and is sober and healthy
			// (https://wiki.bloodontheclocktower.com/Preacher). Choosing a non-Minion does nothing.
			if (typeOf(game, seatId, characters) !== 'minion') continue;
			const preacher = game.seating.find(
				(s) =>
					s !== seatId &&
					trueCharacter(game, s, characters) === 'preacher' &&
					!visiting.has(s) &&
					abilityWorks(game, s, characters, visiting)
			);
			if (preacher) {
				out.push({
					reason: 'no-ability',
					source: { characterId: 'preacher', seatId: preacher, reminderId: r.reminderId },
					wiki: `${W}Preacher`
				});
			}
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

	// The Drunk is drunk whether or not an "Is The Drunk" token says so
	// (https://wiki.bloodontheclocktower.com/Drunk).
	if (characterId === 'drunk' && !out.some((i) => i.source.characterId === 'drunk')) {
		out.push({
			reason: 'drunk',
			source: { characterId: 'drunk', seatId },
			wiki: `${W}Drunk`
		});
	}

	// The Minstrel's "Everyone Is Drunk": every other player but Travellers is drunk.
	const traveller = isTraveller(game, seatId, characters);
	for (const other of traveller ? [] : game.seating) {
		if (other === seatId) continue;
		const token = game.seats[other].reminders.find(
			(r) => r.characterId === GLOBAL_DRUNK.characterId && r.label === GLOBAL_DRUNK.label
		);
		if (!token) continue;
		const minstrel = seatOfCharacter(game, 'minstrel', characters) ?? other;
		if (minstrel === seatId) continue;
		out.push({
			reason: 'drunk',
			source: { characterId: 'minstrel', seatId: minstrel, reminderId: token.reminderId },
			wiki: `${W}Minstrel`
		});
		break;
	}

	// The Witch loses her ability when just 3 players live
	// (https://wiki.bloodontheclocktower.com/Witch).
	if (characterId === 'witch') {
		const alive = game.seating.filter((s) => !game.seats[s].dead).length;
		if (alive <= 3) {
			out.push({
				reason: 'no-ability',
				source: { characterId: 'witch', seatId },
				wiki: `${W}Witch`
			});
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
 * Players whose registration is the Storyteller's choice, or fixed by an ability:
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
		if ((id === 'recluse' || id === 'spy') && abilityState(game, seatId, characters).works) {
			const recluse = id === 'recluse';
			out.push({
				seatId,
				alignments: [alignment, recluse ? 'evil' : 'good'].filter(
					(a, i, all): a is Alignment => all.indexOf(a) === i
				),
				types: [type, ...(recluse ? ['minion', 'demon'] : ['townsfolk', 'outsider'])].filter(
					(t, i, all): t is CharacterType => all.indexOf(t) === i
				),
				source: { characterId: id, seatId },
				wiki: `${W}${recluse ? 'Recluse' : 'Spy'}`
			});
			continue;
		}
		const pawToken = game.seats[seatId].reminders.find(
			(r) => r.characterId === 'lycanthrope' && r.label === 'Faux Paw'
		);
		if (pawToken && alignment === 'good') {
			const lycanthrope = game.seating.find(
				(s) =>
					trueCharacter(game, s, characters) === 'lycanthrope' &&
					abilityState(game, s, characters).works
			);
			if (lycanthrope) {
				out.push({
					seatId,
					alignments: ['evil'],
					types: [type],
					source: {
						characterId: 'lycanthrope',
						seatId: lycanthrope,
						reminderId: pawToken.reminderId
					},
					wiki: `${W}Lycanthrope`
				});
			}
		}
	}
	return out;
}

/** How every player registers in one possible world. */
export interface RegistrationWorld {
	alignment: (seatId: SeatId) => Alignment | undefined;
	type: (seatId: SeatId) => CharacterType | undefined;
	/** Seats registering as something other than their true alignment or type here. */
	misregistered: SeatId[];
}

/** At most this many worlds are enumerated; beyond it, the rest are not considered. */
const MAX_WORLDS = 4096;

/**
 * Every way the players may register. The first world is the default: everyone as they
 * truly are, apart from fixed registrations (Faux Paw), so it gives the true answer.
 */
export function registrationWorlds(
	game: Game,
	characters: CharacterLookup,
	regs: readonly Registration[] = registrations(game, characters)
): RegistrationWorld[] {
	type Choice = { seatId: SeatId; alignment: Alignment; type: CharacterType };
	let combos: Choice[][] = [[]];
	for (const reg of regs) {
		const next: Choice[][] = [];
		for (const combo of combos) {
			for (const alignment of reg.alignments) {
				for (const type of reg.types) {
					if (next.length < MAX_WORLDS)
						next.push([...combo, { seatId: reg.seatId, alignment, type }]);
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

/**
 * Why a player cannot die tonight, when the grimoire says so: the Storyteller's "can die"
 * override, the Sailor's own ability, a Tea Lady's or Innkeeper's protection, or (against
 * the Demon only) the Soldier and the Monk. Each protecting ability must work.
 * https://wiki.bloodontheclocktower.com/Sailor, /Tea_Lady, /Innkeeper, /Soldier, /Monk
 */
export function protection(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	by: 'demon' | 'other'
): AbilitySource | 'override' | undefined {
	const seat = getSeat(game, seatId);
	if (!seat) return undefined;
	const override = seat.overrides.find((o) => o.field === 'canDie');
	if (override) return override.value ? undefined : 'override';
	const id = trueCharacter(game, seatId, characters);
	const works = (s: SeatId) => abilityState(game, s, characters).works;
	if (id === 'sailor' && works(seatId)) return { characterId: 'sailor', seatId };
	if (by === 'demon' && id === 'soldier' && works(seatId))
		return { characterId: 'soldier', seatId };
	const tokens: [CharacterId, string, 'demon' | 'any'][] = [
		['tealady', 'Cannot Die', 'any'],
		['innkeeper', 'Safe', 'any'],
		['monk', 'Safe', 'demon']
	];
	for (const [source, label, against] of tokens) {
		if (against === 'demon' && by !== 'demon') continue;
		const token = seat.reminders.find((r) => r.characterId === source && r.label === label);
		if (!token) continue;
		const from = seatOfCharacter(game, source, characters);
		if (from && !works(from)) continue;
		return { characterId: source, ...(from ? { seatId: from } : {}), reminderId: token.reminderId };
	}
	return undefined;
}
