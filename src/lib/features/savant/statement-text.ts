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

/**
 * The note with the statements on their own lines after anything else written there. Lines
 * already holding statements (starting with `prefixes`) are replaced, so saving again never
 * stacks a second pair (Trevor, 2026-10-24).
 */
export function noteText(
	existing: string,
	lines: readonly string[],
	prefixes: readonly string[] = []
): string {
	return [savedStatements(existing, prefixes).rest, ...lines].filter((l) => l !== '').join('\n');
}

/** A statement saved in the Savant's note: its words and whether it was given as true. */
export interface SavedStatement {
	words: string;
	truth: boolean;
}

/**
 * The statements saved in a Savant note, read back by their True and False prefixes
 * (`[truePrefix, falsePrefix]`), and the rest of the note without them.
 */
export function savedStatements(
	note: string,
	prefixes: readonly string[]
): { statements: SavedStatement[]; rest: string } {
	const [truePrefix, falsePrefix] = prefixes;
	const statements: SavedStatement[] = [];
	const rest: string[] = [];
	for (const line of note.split('\n')) {
		if (truePrefix && line.startsWith(truePrefix)) {
			statements.push({ words: line.slice(truePrefix.length).trim(), truth: true });
		} else if (falsePrefix && line.startsWith(falsePrefix)) {
			statements.push({ words: line.slice(falsePrefix.length).trim(), truth: false });
		} else rest.push(line);
	}
	return { statements, rest: rest.join('\n').trim() };
}
