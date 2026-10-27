/**
 * A draft's seats beyond the picks themselves (Sushi Buffet, `draft.ts`).
 *
 * A reserved hidden character (Grimbits' tool, for the Marionette): with `config.reserve`, a
 * hidden character whose token goes next to another type (the Marionette next to the Demon,
 * https://wiki.bloodontheclocktower.com/Marionette) keeps a seat of its own type out of the
 * draft, and one more Townsfolk is drafted instead. Once everyone has drafted, the Storyteller
 * picks which good neighbour of that type is really it (`reservedSeats`).
 *
 * Players turned into another type (Grimbits' tool, for the Kazali, the Lord of Typhon and Lil'
 * Monsta): with
 * `modifiers` on, a drafted character that turns players into characters of a type
 * (`turnsPlayersInto`) has the Storyteller pick, once everyone has drafted, which character each
 * becomes (`conversions`). The Kazali's are players the Storyteller picks, as many as the setup
 * counts gave that type less those drafted (https://wiki.bloodontheclocktower.com/Kazali). The
 * Lord of Typhon's are its two neighbours, so the evil players sit in a line with it in the
 * middle (https://wiki.bloodontheclocktower.com/Lord_of_Typhon): when it is drafted, that many
 * open seats of the type become Townsfolk seats, so no one else drafts them, and once everyone has
 * drafted each neighbour picks their Minion from offers, as in the draft (`turnOffer`; Trevor,
 * 2026-10-27: "the selected ppl can select their minion through the mulligan"). Lil' Monsta's is the
 * player who drafts it, as it is never dealt (https://wiki.bloodontheclocktower.com/Lil%27_Monsta):
 * its setup change applies and that player drafts again, offered only that type
 * (`draftedTurned` lists such characters, which a draft offers too).
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { SEATED_TYPES, type SeatedType } from '#lib/core/rules/distribution.ts';
import { isReplacedAfterDraw, replacementReminder } from '#lib/core/rules/bag-characters.ts';
import type { TurnsPlayersInto } from '#lib/core/data/turns-players-rules.ts';
import type { DraftState, PendingChange } from './draft.ts';

/** Its own rules (a custom character's) or our rules file's. */
export const rulesFor = (c: Character) => (c.edition === undefined ? c.rules : rulesOf(c.id));

export const isSeated = (type: string): type is SeatedType =>
	(SEATED_TYPES as readonly string[]).includes(type);

/** A hidden character drafted as a good player, next to a seat of `nextTo` (`reservedHidden`). */
export interface ReservedHidden {
	id: CharacterId;
	type: SeatedType;
	nextTo: SeatedType;
}

/**
 * The script's hidden characters that are evil but dealt as good, placed next to a type: the
 * Marionette, whose "Is The Marionette" token goes on a good neighbour of the Demon (its
 * reminder target rule).
 */
export function reservedHidden(characters: readonly Character[]): ReservedHidden[] {
	return characters.flatMap((c) => {
		if ((c.type !== 'minion' && c.type !== 'demon') || !isReplacedAfterDraw(c)) return [];
		const label = replacementReminder(c)?.label;
		const nextTo = label ? rulesFor(c)?.reminderTargets?.[label]?.neighbour?.ofType : undefined;
		return nextTo && isSeated(nextTo) ? [{ id: c.id, type: c.type, nextTo }] : [];
	});
}

/**
 * The seats (by pick index) that may be a reserved hidden character: the nearest good seat each
 * way round from every seat of `nextTo`, skipping evil ones, leaving out seats in `taken`.
 */
export function reservedSeats(
	state: DraftState,
	reserve: ReservedHidden,
	taken: readonly number[] = []
): number[] {
	const { picks, types } = state;
	const evil = (i: number) => types[picks[i]] === 'minion' || types[picks[i]] === 'demon';
	const seats = new Set<number>();
	picks.forEach((id, i) => {
		if (types[id] !== reserve.nextTo) return;
		for (const step of [-1, 1]) {
			for (let n = 1; n < picks.length; n++) {
				const j = (i + step * n + picks.length) % picks.length;
				if (evil(j)) continue;
				seats.add(j);
				break;
			}
		}
	});
	return [...seats].filter((i) => !taken.includes(i)).sort((a, b) => a - b);
}

/** Players a drafted character turns into characters of `type`, once everyone has drafted. */
export interface Conversion {
	characterId: CharacterId;
	/** The seat (by pick index) that drafted it. */
	seat: number;
	/** The seats to turn, for `neighbours`; any good seat otherwise. */
	seats?: number[];
	type: SeatedType;
	players: TurnsPlayersInto['players'];
	/** How many players to turn. */
	count: number;
}

/**
 * The conversions the drafted characters make (`turnsPlayersInto`): for `chosen`, the usual
 * count of the type less those already drafted or reserved (the Kazali's Minions); for
 * `neighbours`, those of its two neighbours not of the type yet (the Lord of Typhon's).
 */
export function conversions(state: DraftState): Conversion[] {
	return state.picks.flatMap((id, seat): Conversion[] => {
		const turns = state.turns?.[id];
		if (!turns) return [];
		if (turns.players === 'neighbours') {
			const seats = neighbours(state, seat).filter(
				(i) => i < state.picks.length && !isEvil(state, state.picks[i])
			);
			const { type, players } = turns;
			return seats.length > 0
				? [{ characterId: id, seat, type, players, count: seats.length, seats }]
				: [];
		}
		const drafted = state.picks.filter((x) => state.types[x] === turns.type).length;
		// A reserved hidden character of the type (the Marionette) is one of them already.
		const kept = state.reserved && state.config.reserve?.type === turns.type ? 1 : 0;
		const count = Math.max(0, turns.usual - drafted - kept);
		return count > 0
			? [{ characterId: id, seat, type: turns.type, players: turns.players, count }]
			: [];
	});
}

/**
 * Characters never dealt whose player turns into another type when drafted (Lil' Monsta): a draft
 * offers them, though a bag doesn't.
 */
export function draftedTurned(characters: readonly Character[]): Character[] {
	return characters.filter((c) => rulesFor(c)?.turnsPlayersInto?.players === 'drafter');
}

/**
 * The seats (by pick index) `conversion` may turn: good ones, of its own seats if it has them,
 * leaving out its character's seat, hidden seats and those in `taken`.
 */
export function turnableSeats(
	state: DraftState,
	conversion: Conversion,
	taken: readonly (number | undefined)[]
): number[] {
	const out = [conversion.seat, ...Object.keys(state.hiddenSeats ?? {}).map(Number), ...taken];
	const among = conversion.seats ?? state.picks.map((_, i) => i);
	return among.filter((i) => !isEvil(state, state.picks[i]) && !out.includes(i));
}

/**
 * The characters of `candidates` a conversion's players may become: of its type, and not in play
 * (drafted, a gained ability, a reserved hidden character).
 */
export function turnOptions(
	state: DraftState,
	conversion: Conversion,
	candidates: readonly Character[]
): Character[] {
	const used = [
		...state.picks,
		...Object.values(state.abilities ?? {}),
		...(state.reserved && state.config.reserve ? [state.config.reserve.id] : [])
	];
	return candidates.filter((c) => c.type === conversion.type && !used.includes(c.id));
}

/**
 * A turned player's offer (the Lord of Typhon's neighbours): up to `size` of `options` at random,
 * leaving out those `refused`, unless every one has been refused.
 */
export function turnOffer(
	options: readonly CharacterId[],
	refused: readonly CharacterId[],
	size: number,
	random: () => number
): CharacterId[] {
	const fresh = options.filter((id) => !refused.includes(id));
	const left = fresh.length > 0 ? fresh : [...options];
	const offer: CharacterId[] = [];
	while (offer.length < size && left.length > 0)
		offer.push(left.splice(Math.floor(random() * left.length), 1)[0]);
	return offer;
}

/** The seats either side of `seat` (by pick index) once every seat has drafted. */
export function neighbours(state: DraftState, seat: number): number[] {
	const left = Object.values(state.slots).reduce((n, open) => n + Math.max(0, open), 0);
	const n = state.picks.length + left;
	if (n < 2) return [];
	const either = new Set([(seat - 1 + n) % n, (seat + 1) % n]);
	return [...either].filter((i) => i !== seat).sort((a, b) => a - b);
}

export const isEvil = (state: DraftState, id: CharacterId) =>
	state.types[id] === 'minion' || state.types[id] === 'demon';

/**
 * A drafted character whose neighbours turn into a type (the Lord of Typhon's Minions): as many
 * open seats of it as neighbours not of it already become Townsfolk seats, after its own setup
 * change, so no one else drafts them.
 */
export function keptForNeighbours(state: DraftState, id: CharacterId): PendingChange[] {
	const turns = state.turns?.[id];
	if (turns?.players !== 'neighbours') return [];
	const seat = state.picks.lastIndexOf(id);
	const known = (i: number) => i < state.picks.length && isEvil(state, state.picks[i]);
	const count = neighbours(state, seat).filter((i) => !known(i)).length;
	return count > 0
		? [{ characterId: id, op: { kind: 'delta', type: turns.type, values: [-count] } }]
		: [];
}
