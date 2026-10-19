import type { CharacterType } from '#lib/core/data/types.ts';
import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
import { SEATED_TYPES, splitPlayers } from '#lib/core/rules/distribution.ts';
import { TYPE_LABELS, TYPE_PLURALS } from '#lib/features/reference/labels.ts';

const EXTRA_TYPES = ['traveller', 'fabled', 'loric'] as const;

/**
 * Game info's Players row (Trevor, 2026-10-19): the player count, then how the characters
 * split by type, "8 (5 Townsfolk, 1 Outsider, 1 Minion, 1 Demon)". The characters in play
 * once any are assigned, so a setup change such as the Baron's shows; before that, the
 * standard split for the table. Travellers, Fabled and Loric follow only when there are any.
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
	for (const id of game.ruleCharacters) {
		const type = characters?.get(id)?.type;
		if (type === 'fabled' || type === 'loric') counts[type]++;
	}
	const parts = [
		...SEATED_TYPES.map((type) => count(type, counts[type])),
		...EXTRA_TYPES.filter((type) => counts[type] > 0).map((type) => count(type, counts[type]))
	];
	return `${seats.length} (${parts.join(', ')})`;
}

function count(type: CharacterType, n: number): string {
	return `${n} ${n === 1 ? TYPE_LABELS[type] : TYPE_PLURALS[type]}`;
}
