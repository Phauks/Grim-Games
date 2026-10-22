import type { CharacterType } from '#lib/core/data/types.ts';
import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
import { SEATED_TYPES, splitPlayers } from '#lib/core/rules/distribution.ts';
import { TYPE_LABELS, TYPE_PLURALS } from '#lib/features/reference/labels.ts';

/**
 * Game info's Players row (Trevor, 2026-10-19): the player count, then how the characters
 * split by type, "8 (5 Townsfolk, 1 Outsider, 1 Minion, 1 Demon)". The characters in play
 * once any are assigned, so a setup change such as the Baron's shows; before that, the
 * standard split for the table. Travellers follow only when there are any. Fabled and Loric
 * are not players (Trevor, 2026-10-20): `ruleCharactersLine` gives them a line of their own.
 */
export function playersLine(game: Game, characters: CharacterLookup | undefined): string {
	const seats = game.seating.map((id) => game.seats[id]);
	const counts: Record<CharacterType, number> = {
		townsfolk: 0,
		outsider: 0,
		minion: 0,
		demon: 0,
		traveller: 0,
		fabled: 0,
		loric: 0
	};
	const assigned = seats.flatMap((s) => {
		const type = s.characterId ? characters?.get(s.characterId)?.type : undefined;
		return type ? [type] : [];
	});
	if (assigned.length > 0) {
		for (const type of assigned) counts[type]++;
	} else {
		const split = splitPlayers(seats.length);
		for (const type of SEATED_TYPES) counts[type] = split.counts[type];
		counts.traveller = split.travellers;
	}
	const parts = [
		...SEATED_TYPES.map((type) => count(type, counts[type])),
		...(counts.traveller > 0 ? [count('traveller', counts.traveller)] : [])
	];
	return `${seats.length} (${parts.join(', ')})`;
}

/**
 * The game's Fabled and Loric, "1 Fabled, 1 Loric", on a line of their own under the
 * Players row: no player is one (Trevor, 2026-10-20). Empty when there are none.
 */
export function ruleCharactersLine(game: Game, characters: CharacterLookup | undefined): string {
	const counts = { fabled: 0, loric: 0 };
	for (const id of game.ruleCharacters) {
		const type = characters?.get(id)?.type;
		if (type === 'fabled' || type === 'loric') counts[type]++;
	}
	return (['fabled', 'loric'] as const)
		.filter((type) => counts[type] > 0)
		.map((type) => count(type, counts[type]))
		.join(', ');
}

function count(type: CharacterType, n: number): string {
	return `${n} ${n === 1 ? TYPE_LABELS[type] : TYPE_PLURALS[type]}`;
}
