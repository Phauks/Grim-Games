import type { CharacterId, CharacterName, PlayerName } from '#lib/core/data/index.ts';
import type { Command, GameLog } from '#lib/core/engine/index.ts';
import { dayUseWho } from '#lib/core/rules/index.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import type { CharacterLookup, DayEntry, Game, SeatId } from '#lib/core/model/index.ts';

/**
 * What the day screen needs from a game: the real saved game (`LiveDay`) or the day spike's
 * sample (`DayGame`). `run` shows warnings and refusals as toasts and says whether it ran.
 */
export interface DayPort {
	readonly game: Game;
	/** The game's log, for who died since the previous day (`recentDeaths`). */
	readonly log: GameLog;
	readonly characters: CharacterLookup;
	run(command: Command): boolean;
	/** The seat's PlayerBadge text: the player's name, or "Seat 3". */
	seatName(seatId: SeatId | undefined): PlayerName;
	characterName(id: CharacterId | undefined): CharacterName;
}

/** A player's claim in town that the day note sheet records (`dayClaim`, all but the Savant's). */
export type NoteClaim = 'guesses' | 'statement' | 'ability-guess';

/** Each claim's button text and its label naming the player. */
export const CLAIM_KEYS = {
	guesses: { name: 'day.guesses', label: 'day.guessesLabel' },
	statement: { name: 'day.statement', label: 'day.statementLabel' },
	'ability-guess': { name: 'day.abilityGuess', label: 'day.abilityGuessLabel' }
} as const satisfies Record<NoteClaim, { name: string; label: string }>;

/** A short line for a day-log entry, in our words (the grimoire's History uses it). */
export function describeEntry(
	entry: DayEntry,
	seatName: (seatId: SeatId | undefined) => string,
	characterName: (id: CharacterId | undefined) => string
): string {
	switch (entry.kind) {
		case 'nomination':
			return t('day.logNomination', {
				nominator: seatName(entry.nominator),
				nominee: seatName(entry.nominee)
			});
		case 'execution':
			if (entry.savedBy)
				return entry.savedBy.characterId
					? t('day.logExecutedSavedBy', {
							name: seatName(entry.seatId),
							character: characterName(entry.savedBy.characterId)
						})
					: t('day.logExecutedSurvived', { name: seatName(entry.seatId) });
			return t(entry.died ? 'day.logExecuted' : 'day.logExecutedDead', {
				name: seatName(entry.seatId)
			});
		case 'exile':
			return t(entry.died ? 'day.logExiled' : 'day.logExiledDead', {
				name: seatName(entry.seatId)
			});
		case 'ability': {
			const names = {
				character: characterName(entry.characterId),
				seat: seatName(entry.seatId)
			};
			if (entry.on === undefined) return t('day.logAbility', names);
			// Official characters' rules only: a custom one's use reads as "on" its player.
			const who = dayUseWho(entry.characterId) ?? 'chosen';
			return t(`day.logAbilityOn.${who}`, { ...names, on: seatName(entry.on) });
		}
		case 'note': {
			const who = entry.seatId
				? t('day.who', {
						character: characterName(entry.characterId),
						seat: seatName(entry.seatId)
					})
				: characterName(entry.characterId);
			const note = t('day.logNote', { who, text: entry.text });
			const answer = entry.answer ? t(`day.answer.${entry.answer}`) : entry.customAnswer;
			const line = answer ? t('day.logAnswer', { line: note, answer }) : note;
			return entry.guesses?.length
				? t('day.logGuesses', { line, count: entry.guesses.length })
				: line;
		}
		case 'wish':
			return t(entry.granted ? 'day.logWishGranted' : 'day.logWishDeclined', {
				character: characterName(entry.characterId),
				seat: seatName(entry.seatId),
				text: entry.text || t('day.wishUnwritten')
			});
		case 'info':
			return t('day.logInfo', {
				character: characterName(entry.characterId),
				seat: seatName(entry.seatId),
				text: entry.text
			});
	}
}
