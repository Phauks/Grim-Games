/**
 * Marks the page while the grimoire board is shown, so every dialog and sheet opened over it
 * blurs the board behind its backdrop (Trevor, 2026-10-23: "when grim is not main screen, we
 * should blur out for game integrity"). The blur itself is in Dialog and BottomSheet.
 * Returns the cleanup that takes the mark off again.
 */
export function markBoardShown(root: HTMLElement = document.documentElement): () => void {
	root.toggleAttribute('data-board-shown', true);
	return () => root.removeAttribute('data-board-shown');
}
