import type { CharacterId, CharacterName, PlayerName } from '#lib/core/data/index.ts';
import type { Command, GameLog } from '#lib/core/engine/index.ts';
import { seatNumber, type CharacterLookup, type Game, type SeatId } from '#lib/core/model/index.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';
import { warningText } from '#lib/features/grimoire/board.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';
import type { DayPort } from './day-port.ts';

/**
 * The day screen on a saved game: commands run on it and are saved; warnings and refusals
 * show as toasts, so nothing on the page moves.
 */
export class LiveDay implements DayPort {
	constructor(readonly open: OpenGame) {}

	get game(): Game {
		return this.open.game;
	}

	get log(): GameLog {
		return this.open.session.log;
	}

	get characters(): CharacterLookup {
		return this.open.characters;
	}

	run(command: Command): boolean {
		const result = this.open.run(command);
		if (!result.ok) {
			toast(t('day.notDone'), result.error.message);
			return false;
		}
		for (const warning of result.warnings) {
			const text = warningText(warning, this.open.characters);
			if (text) toast(t('day.toastNote'), text);
		}
		return true;
	}

	seatName(seatId: SeatId | undefined): PlayerName {
		if (seatId === undefined) return '';
		const name = this.game.seats[seatId]?.playerName;
		const number = seatNumber(this.game, seatId);
		return name ?? (number === undefined ? t('day.unknownSeat') : t('common.seat', { number }));
	}

	characterName(id: CharacterId | undefined): CharacterName {
		return id === undefined ? '' : (this.characters.get(id)?.name ?? id);
	}
}
