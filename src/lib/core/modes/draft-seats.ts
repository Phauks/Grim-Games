/**
 * A draft's seats beyond the picks themselves (Sushi Buffet, `draft.ts`).
 *
 * A reserved hidden character (Grimbits' tool, for the Marionette): with `config.reserve`, a
 * hidden character whose token goes next to another type (the Marionette next to the Demon,
 * https://wiki.bloodontheclocktower.com/Marionette) keeps a seat of its own type out of the
 * draft, and one more Townsfolk is drafted instead. Once everyone has drafted, the Storyteller
 * picks which good neighbour of that type is really it (`reservedSeats`), and must pick one
 * (Trevor, 2026-11-16). With three Minions one more seat is kept and a good player becomes that
 * Minion at the end, as the wiki's How to Run says. Its seat is dropped when a drafted character
 * leaves none of its type (Legion, the Atheist), and goes back to its type when there is none of
 * the type it sits beside (the Summoner, Lil' Monsta).
 *
 * Players turned into another type (Grimbits' tool, for the Kazali, the Lord of Typhon and Lil'
 * Monsta): with
 * `modifiers` on, a drafted character that turns players into characters of a type
 * (`turnsPlayersInto`) has the Storyteller pick, once everyone has drafted, which character each
 * becomes (`conversions`). The Kazali's are players the Storyteller picks, as many as the setup
 * counts gave that type less those drafted (https://wiki.bloodontheclocktower.com/Kazali). The
 * Lord of Typhon's are its two neighbours, so the evil players sit in a line with it in the
 * middle (https://wiki.bloodontheclocktower.com/Lord_of_Typhon): when it is drafted, every open
 * seat of the type becomes a Townsfolk seat, so no one else drafts them, and once everyone has
 * drafted that many players in a line with it, its neighbours first, each pick their Minion from
 * offers, as in the draft (`turnOffer`; Trevor,
 * 2026-10-27: "the selected ppl can select their minion through the mulligan"). Lil' Monsta's is the
 * player who drafts it, as it is never dealt (https://wiki.bloodontheclocktower.com/Lil%27_Monsta):
 * its setup change applies and that player drafts again, offered only that type
 * (`draftedTurned` lists such characters, which a draft offers too).
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import { rulesOfCharacter } from '#lib/core/data/rules/index.ts';
import { SEATED_TYPES, type SeatedType } from '#lib/core/data/types.ts';
import { isReplacedAfterDraw, replacementReminder } from '#lib/core/rules/setup/bag-characters.ts';
import type { TurnsPlayersInto } from '#lib/core/data/parts/turns-players-into.ts';
import type { DraftState, PendingChange } from './draft.ts';

/** Its own rules (a custom character's) or our rules file's. */
export const rulesFor = (c: Character) => rulesOfCharacter(c);

export const isSeated = (type: string): type is SeatedType =>
	(SEATED_TYPES as readonly string[]).includes(type);

/** A hidden character drafted as a good player, next to a seat of `nextTo` (`reservedHidden`). */
export interface ReservedHidden {
	id: CharacterId;
	type: SeatedType;
	nextTo: SeatedType;
	/**
	 * With at least this many of its type, one more seat of it is kept and a good player turned
	 * into it at the end (its `changesCharacter.minMinions`: the Marionette's third Minion).
	 */
	alsoAt?: number;
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
		const rules = rulesFor(c);
		const nextTo = label ? rules?.reminderTargets?.[label]?.neighbour?.ofType : undefined;
		const alsoAt = rules?.changesCharacter?.minMinions;
		return nextTo && isSeated(nextTo)
			? [{ id: c.id, type: c.type, nextTo, ...(alsoAt !== undefined ? { alsoAt } : {}) }]
			: [];
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
export function conversions(state: DraftState, alsoEvil: readonly number[] = []): Conversion[] {
	const turned = state.picks.flatMap((id, seat): Conversion[] => {
		const turns = state.turns?.[id];
		if (!turns) return [];
		if (turns.players === 'neighbours') {
			const seats = lineSeats(state, seat, state.line ?? 0, alsoEvil);
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
	// The reserved character's extra seat (the Marionette's third Minion): a good player the
	// Storyteller picks becomes one, unless a drafted character already turns players into it.
	const reserve = state.config.reserve;
	const extra = state.reserved ? (state.reservedExtra ?? 0) : 0;
	if (reserve && extra > 0 && !turned.some((c) => c.type === reserve.type))
		turned.push({
			characterId: reserve.id,
			seat: -1,
			type: reserve.type,
			players: 'chosen',
			count: extra
		});
	return turned;
}

/**
 * The good seats (by pick index) a character turns to make its line `count` long, nearest first
 * and taking each side in turn, so it stays in the middle; evil seats already in the line (and
 * `alsoEvil`, a seat that is secretly evil) extend it without being turned
 * (https://wiki.bloodontheclocktower.com/Lord_of_Typhon: "All evil characters must be in the line
 * at setup").
 */
function lineSeats(
	state: DraftState,
	seat: number,
	count: number,
	alsoEvil: readonly number[]
): number[] {
	const n = state.picks.length;
	const evil = (i: number) => alsoEvil.includes(i) || isEvil(state, state.picks[i]);
	const out: number[] = [];
	const reach = { [-1]: 0, [1]: 0 } as Record<number, number>;
	let side = -1;
	while (out.length < count && reach[-1] + reach[1] < n - 1) {
		reach[side] += 1;
		const i = (seat + side * reach[side] + n) % n;
		if (!evil(i)) out.push(i);
		side = -side;
	}
	return out.sort((a, b) => a - b);
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

const isEvil = (state: DraftState, id: CharacterId) =>
	state.types[id] === 'minion' || state.types[id] === 'demon';

/**
 * A drafted character whose neighbours turn into a type (the Lord of Typhon's Minions): every
 * open seat of it becomes a Townsfolk seat, after its own setup change, so no one else drafts
 * them; at the end that many good players in a line with it are turned (`conversions`).
 */
export function keptForNeighbours(state: DraftState, id: CharacterId): PendingChange[] {
	const turns = state.turns?.[id];
	if (turns?.players !== 'neighbours') return [];
	const drafted = state.picks.filter((x) => state.types[x] === turns.type).length;
	return [
		{ characterId: id, op: { kind: 'set', type: turns.type, values: [drafted] }, line: true }
	];
}
