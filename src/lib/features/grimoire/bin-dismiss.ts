/**
 * When a pulled-up reminder bin (the Storyteller's bank, a player's bin sheet) closes by
 * itself: a press outside it, or Escape.
 */

/** A press outside `el` that closes it. */
export function pressedOutside(event: PointerEvent, el: Element | undefined): boolean {
	const target = event.target as Element | null;
	// What opens it (`data-bin-opener`) toggles it itself.
	if (!target || el?.contains(target) || target.closest?.('[data-bin-opener]')) return false;
	// A dialog opened from it (choosing a seat) isn't outside it, nor is its backdrop while it
	// fades away.
	return !target.closest?.('[role="dialog"], [role="alertdialog"], [data-part="backdrop"]');
}

/**
 * Escape closes it, unless a dialog is over it or the key is pressed in a menu (a held
 * token's ⋯): then Escape closes only that.
 */
export function escapeCloses(event: KeyboardEvent): boolean {
	const inMenu = (event.target as Element | null)?.closest?.('[data-scope="menu"]');
	return (
		event.key === 'Escape' &&
		!inMenu &&
		!document.querySelector('[role="dialog"], [role="alertdialog"]')
	);
}
