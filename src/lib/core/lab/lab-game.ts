/**
 * The Character Lab (plan M37, Trevor 2026-11-03: "quickly load up just like a 12-player game
 * and check to like see how does the philosopher deal with like if this other character
 * there"): the characters to test against the locked ones, and a game that seats them.
 *
 * Everything here reads the data (`jinxes.json`, `roles.json`, the setup counts), so a new
 * jinx or character shows up with no change here; no character is named.
 */
import type { GameData } from '#lib/core/data/game-data.ts';
import { jinxesAmong } from '#lib/core/data/jinxes.ts';
import type { OfficialEditionId } from '#lib/core/data/script.ts';
import {
	SEATED_TYPES,
	type Character,
	type CharacterId,
	type CharacterType,
	type Jinx,
	type SeatedType
} from '#lib/core/data/types.ts';
import { canDuplicate, isNotDealt, isReplacedAfterDraw } from '#lib/core/rules/bag-characters.ts';
import { jinxRulesBetween } from '#lib/core/rules/jinx-pairs.ts';
import { reservedHidden } from '#lib/core/modes/draft-seats.ts';
import { analyseSetup } from '#lib/core/rules/setup.ts';
import { setupModifierFor } from '#lib/core/rules/setup-modifiers.ts';

/** Where the opponents come from. */
export type OpponentSource =
	| { kind: 'jinxes' }
	| { kind: 'type'; type: CharacterType }
	| { kind: 'all' }
	/** Hand-picked, in the order picked. */
	| { kind: 'picked'; ids: readonly CharacterId[] };

/** Where the opponent goes in the game: on a seat, only on the script, or a Demon bluff. */
export const OPPONENT_PLACES = ['in-play', 'script', 'bluff'] as const;
export type OpponentPlace = (typeof OPPONENT_PLACES)[number];

export interface LabOpponent {
	id: CharacterId;
	/** Its jinxes with the locked characters, in `jinxes.json` order; empty for none. */
	jinxes: Jinx[];
}

/** The types that go in the game's Fabled and Loric, never on a seat. */
const RULE_TYPES: readonly CharacterType[] = ['fabled', 'loric'];
const GOOD_TYPES: readonly CharacterType[] = ['townsfolk', 'outsider'];
const BLUFFS = 3;

const isSeated = (type: CharacterType): type is SeatedType =>
	(SEATED_TYPES as readonly string[]).includes(type);

/**
 * The characters to test against `locked`, from `source`, without the locked ones. Jinxes:
 * every character jinxed with any locked one, in `jinxes.json` order. A type or every
 * character: in `roles.json` order. Hand-picked: in the order picked.
 */
export function labOpponents(
	data: GameData,
	locked: readonly CharacterId[],
	source: OpponentSource
): LabOpponent[] {
	const lockedSet = new Set(locked);
	const withJinxes = (id: CharacterId): LabOpponent => ({
		id,
		jinxes: jinxesAmong(data.jinxes, [id, ...locked]).filter(({ characters }) =>
			characters.includes(id)
		)
	});
	if (source.kind === 'jinxes') {
		const ids: CharacterId[] = [];
		for (const { characters } of data.jinxes.all) {
			const [a, b] = characters;
			const partner = lockedSet.has(a) ? b : lockedSet.has(b) ? a : undefined;
			if (partner && !lockedSet.has(partner) && !ids.includes(partner)) ids.push(partner);
		}
		return ids.map(withJinxes);
	}
	if (source.kind === 'picked')
		return source.ids.filter((id) => data.byId.has(id) && !lockedSet.has(id)).map(withJinxes);
	return data.characters
		.filter((c) => !lockedSet.has(c.id) && (source.kind === 'all' || c.type === source.type))
		.map((c) => withJinxes(c.id));
}

/** Where the other seats come from: one official edition, or every official character. */
export type LabFiller = OfficialEditionId | 'all';

export interface LabSetup {
	playerCount: number;
	/** Kept in every game, on the first seats in this order (Fabled and Loric: in play). */
	locked: readonly CharacterId[];
	opponent?: CharacterId;
	place: OpponentPlace;
	/** The characters that fill the other seats (and, for an edition, the rest of the script). */
	filler: LabFiller;
	/**
	 * Sets the game up as after a draw (Trevor, 2026-11-04: "automatically apply setup tokens
	 * (it is fine if it is random)"): stand-ins for the Drunk and the Marionette here, and the
	 * setup reminders when the game loads. Default on; off seats every character as it is.
	 */
	setupTokens?: boolean;
}

export interface LabGame {
	/** The script, in `roles.json` order. */
	script: CharacterId[];
	/** Fabled and Loric in play. */
	ruleCharacters: CharacterId[];
	/** A character for each seat, from the first. */
	seats: CharacterId[];
	/** The Demon's bluffs: good characters on the script and not in play. */
	bluffs: CharacterId[];
	/**
	 * Seats whose player thinks they are someone else, as after a real draw: the character on
	 * the seat's token (`shows`), with the true one (`seats`) marked by its "Is The ..."
	 * reminder (the Drunk thinks they are a Townsfolk, the Marionette a good character).
	 */
	standIns: { seat: number; shows: CharacterId }[];
}

/** `list` in a random order (Fisher-Yates), drawing from `random` (0 to 1, as Math.random). */
function shuffled<T>(list: readonly T[], random: () => number): T[] {
	const out = [...list];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * The count to deal of one type, from the counts the setup check allows: the setup sheet's own
 * when allowed, else the nearest to it (the larger on a tie, so "+1 Minion, or none" deals the
 * extra Minion). Counts below what is already seated are passed over while a larger one exists.
 */
function pickCount(allowed: readonly number[], usual: number, seated: number): number {
	const enough = allowed.filter((n) => n >= seated);
	const from = enough.length ? enough : allowed;
	if (from.includes(usual)) return usual;
	return from.reduce((best, n) => {
		const d = Math.abs(n - usual) - Math.abs(best - usual);
		return d < 0 || (d === 0 && n > best) ? n : best;
	});
}

/**
 * A game for one test, set up as a Storyteller would (https://wiki.bloodontheclocktower.com/Setup):
 * the locked characters (and the opponent, when in play) on the first seats, then any
 * character one of them needs in play (the Choirboy's King), the other seats filled from the
 * filler to the counts the setup check gives for the characters in play (their [bracketed]
 * setup changes included), less the types already seated. A character that is never dealt
 * (Lil' Monsta) is in play from the script, on no seat. A character that may repeat and sets
 * its own type's count (Legion) fills that count with copies. One that must neighbour a type
 * (the Marionette, the Demon) gets one beside it. A Traveller takes a seat outside the counts.
 * Filler characters change nothing at setup and have no exclusive jinx with those in play, so
 * only the chosen characters change the game. When the filler runs out of a type, any official
 * character of that type fills in.
 */
export function labGame(data: GameData, setup: LabSetup, random = Math.random): LabGame {
	const character = (id: CharacterId): Character | undefined => data.byId.get(id);
	const typeOf = (id: CharacterId) => character(id)?.type;
	const wanted = [...setup.locked, ...(setup.opponent ? [setup.opponent] : [])];
	const ruleCharacters = wanted.filter((id) => {
		const type = typeOf(id);
		return type !== undefined && RULE_TYPES.includes(type);
	});
	const notDealt = (id: CharacterId) => {
		const c = character(id);
		return c !== undefined && isNotDealt(c);
	};
	const opponentInPlay =
		setup.opponent !== undefined &&
		(setup.place === 'in-play' || ruleCharacters.includes(setup.opponent));
	const lockedSeats = setup.locked.filter((id) => !ruleCharacters.includes(id) && !notDealt(id));
	const opponentSeated =
		opponentInPlay && !ruleCharacters.includes(setup.opponent!) && !notDealt(setup.opponent!);
	const unseatedInPlay = [
		...setup.locked.filter(notDealt),
		...(opponentInPlay && notDealt(setup.opponent!) ? [setup.opponent!] : [])
	];
	const chosen = [...lockedSeats, ...(opponentSeated ? [setup.opponent!] : [])];
	// Characters the chosen ones need in play ("+the King"), on the next seats.
	for (const id of [...chosen, ...ruleCharacters, ...unseatedInPlay]) {
		const c = character(id);
		const needs = c && setupModifierFor(c)?.requires;
		if (needs && data.byId.has(needs) && !chosen.includes(needs)) chosen.push(needs);
	}
	const fixed = chosen.slice(0, setup.playerCount);

	const travellers = fixed.filter((id) => typeOf(id) === 'traveller').length;
	const inPlay = [...fixed, ...ruleCharacters, ...unseatedInPlay].flatMap((id) => {
		const c = character(id);
		return c ? [c] : [];
	});
	const analysis = analyseSetup({
		players: setup.playerCount,
		travellers,
		inPlay,
		findById: character
	});
	const seatedOf = (type: SeatedType) => fixed.filter((id) => typeOf(id) === type).length;
	const counts = {} as Record<SeatedType, number>;
	for (const type of ['outsider', 'minion', 'demon'] as const)
		counts[type] = pickCount(analysis.expected[type], analysis.base[type], seatedOf(type));
	counts.townsfolk = Math.max(0, analysis.dealt - counts.outsider - counts.minion - counts.demon);
	for (const type of SEATED_TYPES) counts[type] = Math.max(0, counts[type] - seatedOf(type));

	// Kept off the seats: everything already placed, and an opponent that isn't in play.
	const used = new Set<CharacterId>([...wanted, ...fixed]);
	const open = setup.playerCount - fixed.length;
	const filled: CharacterId[] = [];
	// A chosen character that may repeat and sets its own type's count fills it (Legion).
	for (const c of inPlay) {
		const type = c.type;
		if (!isSeated(type) || !canDuplicate(c, inPlay)) continue;
		const ownCount = setupModifierFor(c)?.ops.some((op) => op.kind === 'set' && op.type === type);
		while (ownCount && counts[type] > 0 && filled.length < open) {
			filled.push(c.id);
			counts[type]--;
		}
	}
	const changesNothing = (c: Character) => {
		if (isNotDealt(c)) return false;
		const modifier = setupModifierFor(c);
		if (
			modifier &&
			(modifier.ops.length || modifier.requires || modifier.alignments || modifier.copies)
		)
			return false;
		return !inPlay.some((other) => jinxRulesBetween(c.id, other.id, data.byId)?.exclusive);
	};
	const pool =
		setup.filler === 'all'
			? data.characters
			: data.characters.filter((c) => c.edition === setup.filler);
	for (const type of SEATED_TYPES) {
		const take = (from: readonly Character[]) => {
			for (const c of shuffled(from, random)) {
				if (counts[type] === 0 || filled.length === open) return;
				if (c.type !== type || used.has(c.id) || !changesNothing(c)) continue;
				used.add(c.id);
				filled.push(c.id);
				counts[type]--;
			}
		};
		take(pool);
		// The filler is short of this type: any official one.
		take(data.characters);
	}
	// Seats over the counts (more locked than the counts allow): Townsfolk.
	while (filled.length < open) {
		const spare = data.characters.find(
			(c) => c.type === 'townsfolk' && !used.has(c.id) && changesNothing(c)
		);
		if (!spare) break;
		used.add(spare.id);
		filled.push(spare.id);
	}
	const seats = [...fixed, ...shuffled(filled, random)];
	seatNeighbours(seats, fixed.length, inPlay, typeOf);

	const onScript = new Set<CharacterId>([
		...(setup.filler === 'all' ? [] : pool.filter((c) => isSeated(c.type)).map((c) => c.id)),
		...wanted.filter((id) => !ruleCharacters.includes(id)),
		...seats
	]);
	const seated = new Set(seats);
	const goodOff = shuffled(
		(setup.filler === 'all'
			? data.characters
			: data.characters.filter((c) => onScript.has(c.id))
		).filter(
			(c) =>
				!seated.has(c.id) &&
				!wanted.includes(c.id) &&
				GOOD_TYPES.includes(c.type) &&
				changesNothing(c)
		),
		random
	).map((c) => c.id);
	const bluffs =
		setup.place === 'bluff' && setup.opponent && !seated.has(setup.opponent)
			? [setup.opponent, ...goodOff].slice(0, BLUFFS)
			: goodOff.slice(0, BLUFFS);
	for (const id of bluffs) onScript.add(id);

	// A seat with no token of its own in the bag (the Drunk, the Marionette) holds a Townsfolk
	// not in play, as the token its player drew (https://wiki.bloodontheclocktower.com/Drunk,
	// https://wiki.bloodontheclocktower.com/Marionette).
	const standIns: LabGame['standIns'] = [];
	const shown = new Set<CharacterId>([...seated, ...bluffs, ...wanted]);
	seats.forEach((id, seat) => {
		const c = character(id);
		if (setup.setupTokens === false || !c || !isReplacedAfterDraw(c)) return;
		const fits = (from: readonly Character[]) =>
			shuffled(from, random).find(
				(o) =>
					o.type === 'townsfolk' && !shown.has(o.id) && changesNothing(o) && !isReplacedAfterDraw(o)
			);
		const shows = fits(pool) ?? fits(data.characters);
		if (!shows) return;
		shown.add(shows.id);
		onScript.add(shows.id);
		standIns.push({ seat, shows: shows.id });
	});

	return {
		script: data.characters.filter((c) => onScript.has(c.id)).map((c) => c.id),
		ruleCharacters,
		seats,
		bluffs,
		standIns
	};
}

/**
 * Seats one of the type a chosen character must neighbour beside it (the Marionette sits next
 * to the Demon, https://wiki.bloodontheclocktower.com/Marionette): swaps a filled seat of that
 * type into a free seat either side, when neither neighbour is one already. The first `fixed`
 * seats stay put.
 */
function seatNeighbours(
	seats: CharacterId[],
	fixed: number,
	inPlay: readonly Character[],
	typeOf: (id: CharacterId) => CharacterType | undefined
): void {
	const n = seats.length;
	if (n < 3) return;
	for (const { id, nextTo } of reservedHidden(inPlay)) {
		const at = seats.indexOf(id);
		if (at < 0) continue;
		const sides = [(at + 1) % n, (at + n - 1) % n];
		if (sides.some((i) => typeOf(seats[i]) === nextTo)) continue;
		const from = seats.findIndex((s, i) => i >= fixed && typeOf(s) === nextTo);
		const to = sides.find((i) => i >= fixed);
		if (from < 0 || to === undefined) continue;
		[seats[from], seats[to]] = [seats[to], seats[from]];
	}
}

/** The key a pairing's result is kept under: the locked characters, sorted, and the opponent. */
export function pairingKey(locked: readonly CharacterId[], opponent: CharacterId): string {
	return [...[...locked].sort(), opponent].join('+');
}

/**
 * The character before or after `from` in `roles.json` order (`step` -1 or 1), wrapping round,
 * to test next without the picker (Trevor, 2026-11-03: "easy to navigate between characters").
 * Skips `skip` (the other locked characters) and, with `jinxedOnly`, every character with no
 * jinx. Undefined when no other character qualifies.
 */
export function stepCharacter(
	data: GameData,
	from: CharacterId,
	step: -1 | 1,
	skip: readonly CharacterId[] = [],
	jinxedOnly = false
): CharacterId | undefined {
	const list = data.characters;
	const start = list.findIndex((c) => c.id === from);
	for (let n = 1; n < list.length; n++) {
		const c = list[(((start + step * n) % list.length) + list.length) % list.length];
		if (c.id === from || skip.includes(c.id)) continue;
		if (jinxedOnly && !data.jinxes.byCharacter.get(c.id)?.length) continue;
		return c.id;
	}
	return undefined;
}
