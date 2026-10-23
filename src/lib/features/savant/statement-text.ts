/**
 * A Savant statement as plain words, for the Savant's day note: seats as "Seat 3 (Alex)",
 * characters by name. The sheet draws the same parts with badges.
 */
import type { CharacterType } from '#lib/core/data/index.ts';
import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
import type { SavantPart, SavantStatement } from '#lib/core/rules/index.ts';
import { seatLabel } from '#lib/features/game/seat-label.ts';

/** Character type names, as the game spells them. */
export const TYPE_NAMES: Readonly<Record<CharacterType, string>> = {
	townsfolk: 'Townsfolk',
	outsider: 'Outsider',
	minion: 'Minion',
	demon: 'Demon',
	traveller: 'Traveller',
	fabled: 'Fabled',
	loric: 'Loric'
};

export function statementText(s: SavantStatement, game: Game, characters: CharacterLookup): string {
	return partsText(s.parts, game, characters);
}

/** Any statement parts as plain words (a statement, or one of its reasons). */
export function partsText(
	parts: readonly SavantPart[],
	game: Game,
	characters: CharacterLookup
): string {
	return parts
		.map((p) =>
			'text' in p
				? p.text
				: 'seat' in p
					? seatLabel(game, p.seat)
					: 'character' in p
						? (characters.get(p.character)?.name ?? p.character)
						: 'type' in p
							? TYPE_NAMES[p.type]
							: String(p.number)
		)
		.join('');
}

/** The note with the statements added on their own lines after anything already written. */
export function noteText(existing: string, lines: readonly string[]): string {
	return [existing.trim(), ...lines].filter((l) => l !== '').join('\n');
}
