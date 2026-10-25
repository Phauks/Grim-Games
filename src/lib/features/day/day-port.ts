import type { CharacterId, CharacterName } from '#lib/core/data/index.ts';
import type { Command, GameLog } from '#lib/core/engine/index.ts';
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
	seatName(seatId: SeatId | undefined): string;
	characterName(id: CharacterId | undefined): CharacterName;
}

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
		case 'ability':
			return t('day.logAbility', {
				character: characterName(entry.characterId),
				seat: seatName(entry.seatId)
			});
		case 'note': {
			const who = entry.seatId
				? t('day.who', {
						character: characterName(entry.characterId),
						seat: seatName(entry.seatId)
					})
				: characterName(entry.characterId);
			const line = t('day.logNote', { who, text: entry.text });
			return entry.guesses?.length
				? t('day.logGuesses', { line, count: entry.guesses.length })
				: line;
		}
		case 'info':
			return t('day.logInfo', {
				character: characterName(entry.characterId),
				seat: seatName(entry.seatId),
				text: entry.text
			});
	}
}
