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
import { baseCounts } from '#lib/core/rules/distribution.ts';

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

export interface LabSetup {
	playerCount: number;
	/** Kept in every game, on the first seats in this order (Fabled and Loric: in play). */
	locked: readonly CharacterId[];
	opponent?: CharacterId;
	place: OpponentPlace;
	/** The edition whose characters fill the other seats and the rest of the script. */
	filler: OfficialEditionId;
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
 * A game for one test: the locked characters (and the opponent, when in play) on the first
 * seats, the other seats filled from the filler edition to the standard counts for that many
 * players, less the types already seated. A Traveller takes a seat outside the counts. When
 * the edition runs out of a type, any official character of that type fills in.
 */
export function labGame(data: GameData, setup: LabSetup, random = Math.random): LabGame {
	const character = (id: CharacterId): Character | undefined => data.byId.get(id);
	const wanted = [...setup.locked, ...(setup.opponent ? [setup.opponent] : [])];
	const ruleCharacters = wanted.filter((id) => {
		const type = character(id)?.type;
		return type !== undefined && RULE_TYPES.includes(type);
	});
	const lockedSeats = setup.locked.filter((id) => !ruleCharacters.includes(id));
	const opponentSeated =
		setup.opponent !== undefined &&
		setup.place === 'in-play' &&
		!ruleCharacters.includes(setup.opponent);
	const fixed = [...lockedSeats, ...(opponentSeated ? [setup.opponent!] : [])].slice(
		0,
		setup.playerCount
	);

	const travellers = fixed.filter((id) => character(id)?.type === 'traveller').length;
	const counts = baseCounts(Math.max(0, setup.playerCount - travellers));
	for (const id of fixed) {
		const type = character(id)?.type;
		if (type && isSeated(type)) counts[type] = Math.max(0, counts[type] - 1);
	}

	// Kept off the seats: everything already placed, and an opponent that isn't in play.
	const used = new Set<CharacterId>([...wanted]);
	const edition = data.characters.filter((c) => c.edition === setup.filler);
	const open = setup.playerCount - fixed.length;
	const filled: CharacterId[] = [];
	for (const type of SEATED_TYPES) {
		const take = (from: readonly Character[]) => {
			for (const c of shuffled(from, random)) {
				if (counts[type] === 0 || filled.length === open) return;
				if (c.type !== type || used.has(c.id)) continue;
				used.add(c.id);
				filled.push(c.id);
				counts[type]--;
			}
		};
		take(edition);
		// The edition is short of this type: any official one.
		take(data.characters);
	}
	// Seats over the counts (more locked than the counts allow): Townsfolk.
	while (filled.length < open) {
		const spare = data.characters.find((c) => c.type === 'townsfolk' && !used.has(c.id));
		if (!spare) break;
		used.add(spare.id);
		filled.push(spare.id);
	}
	const seats = [...fixed, ...shuffled(filled, random)];

	const onScript = new Set<CharacterId>([
		...edition.filter((c) => isSeated(c.type)).map((c) => c.id),
		...wanted.filter((id) => !ruleCharacters.includes(id)),
		...seats
	]);
	const inPlay = new Set(seats);
	const goodOff = shuffled(
		data.characters.filter(
			(c) =>
				onScript.has(c.id) &&
				!inPlay.has(c.id) &&
				c.id !== setup.opponent &&
				GOOD_TYPES.includes(c.type)
		),
		random
	).map((c) => c.id);
	const bluffs =
		setup.place === 'bluff' && setup.opponent && !inPlay.has(setup.opponent)
			? [setup.opponent, ...goodOff].slice(0, BLUFFS)
			: goodOff.slice(0, BLUFFS);

	return {
		script: data.characters.filter((c) => onScript.has(c.id)).map((c) => c.id),
		ruleCharacters,
		seats,
		bluffs
	};
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
