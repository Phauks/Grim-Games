import type { Reminder } from '#lib/core/model/index.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';
import type { Grimoire } from './grimoire.svelte.ts';
import { isGeneric } from './reminders.ts';

/**
 * Duplicate reminder (Trevor, 2026-10-18): another copy of the token in the reminder bank,
 * never on the board (Trevor, 2026-10-20). More copies than the game gives is unusual, so a
 * toast says so; never blocked.
 */
export function duplicateReminder(
	grimoire: Grimoire,
	token: Pick<Reminder, 'characterId' | 'label'>
): void {
	grimoire.addBankCopy({ characterId: token.characterId, label: token.label });
	// An ∞ token has no limit, so another copy is never unusual (Trevor, 2026-10-23).
	if (!isGeneric(token))
		toast('Uncommon', 'More copies of this reminder than the game gives. The copy is in the bank.');
}
