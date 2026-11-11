/**
 * The board's side of the shared tray gestures (tray-gestures.svelte.ts): where its seats and
 * Fabled or Loric are, and its tokens kept as Game commands. A move or a token off a seat goes
 * through ReminderMoveConfirm, which asks first when it normally stays put, so it is one History
 * entry. A player's tray has its own (player/player-tray-places.ts); the gestures are the same.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import {
	ruleReminders,
	type GenericLook,
	type ReminderId,
	type SeatId
} from '#lib/core/model/index.ts';
import { bankLabel, bankLook, type BankItem } from './bank-items.ts';
import type { Grimoire } from './grimoire.svelte.ts';
import type { ReminderDragging } from './reminder-drag.svelte.ts';
import type ReminderMoveConfirm from './ReminderMoveConfirm.svelte';
import { isGeneric, looksLike, onBoard } from './reminders.ts';
import type { TrayPlaces } from './tray-gestures.svelte.ts';

export interface BoardTrayContext {
	grimoire: Grimoire;
	board: HTMLElement | undefined;
	remDrag: ReminderDragging;
	confirm: ReturnType<typeof ReminderMoveConfirm> | undefined;
	/** Marks the seats for a bank token on the move (ReminderBank `hint`). */
	hint: (item: BankItem | undefined, target?: SeatId) => void;
}

export function boardTrayPlaces(context: () => BoardTrayContext): TrayPlaces {
	const game = () => context().grimoire.game;
	return {
		area: () => context().board,
		seatAt: (at, tap) => context().remDrag.seatAt(at, tap),
		ruleAt: (x, y, face) => context().remDrag.ruleAt(x, y, face),
		placed: (reminderId) => onBoard(game()).find((r) => r.reminderId === reminderId),
		place(item, to, number, look) {
			const { grimoire, confirm } = context();
			const tokenId = item.token?.tokenId;
			const reminder = {
				characterId: item.characterId,
				label: bankLabel(item),
				ownerSeatId: item.ownerSeatId
			};
			// A look given in hand goes over the token's own; none leaves a character's reminder
			// without one.
			const placedLook: GenericLook | undefined =
				Object.keys(look).length > 0
					? { ...bankLook(item, number), ...look }
					: bankLook(item, number);
			// On a Fabled or Loric: it holds the reminder (Trevor, 2026-10-17), asking first when
			// it isn't theirs.
			if ('ruleId' in to) return confirm?.requestRule(reminder, to.ruleId, tokenId, placedLook);
			// Any seat will do: the Storyteller can override the suggestion.
			grimoire.run({
				type: 'AddReminder',
				seatId: to.seatId,
				reminder,
				tokenId,
				look: placedLook
			});
		},
		move(reminderId, _from, to) {
			const { confirm } = context();
			if ('seatId' in to) return confirm?.request(reminderId as ReminderId, to.seatId);
			const rule: CharacterId = to.ruleId;
			if (!ruleReminders(game(), rule).some((r) => r.reminderId === reminderId))
				confirm?.requestRule(reminderId as ReminderId, rule);
		},
		takeOff: (reminderId) => context().confirm?.requestReturn(reminderId as ReminderId),
		addToken(look) {
			const { grimoire } = context();
			if (!grimoire.run({ type: 'AddGenericToken', look })) return undefined;
			return grimoire.game.genericTokens.at(-1)?.tokenId;
		},
		removeToken: (tokenId) => context().grimoire.run({ type: 'RemoveGenericToken', tokenId }),
		copiesOf(tokenId) {
			const token = game().genericTokens.find((t) => t.tokenId === tokenId);
			if (!token) return [];
			return onBoard(game())
				.filter((r) => isGeneric(r) && looksLike(r, token))
				.map((r) => r.reminderId);
		},
		tokens: () => game().genericTokens,
		hint: (_face, item, target) => context().hint(item, target)
	};
}
