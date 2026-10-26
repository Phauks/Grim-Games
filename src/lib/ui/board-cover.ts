/**
 * Marks the page while the grimoire board is shown, so every dialog and sheet opened over it
 * blurs the board behind its backdrop (Trevor, 2026-10-23: "when grim is not main screen, we
 * should blur out for game integrity"). The blur itself is in Dialog and BottomSheet.
 * A player's Grim tab marks it too (Trevor, 2026-10-26: Share on a player's phone showed
 * their guesses). Returns the cleanup that takes this mark off; the page stays marked while
 * any other board or Grim tab still is (the board's Script dialog shows a Grim tab over it).
 */
const marks = new WeakMap<HTMLElement, number>();

export function markBoardShown(root: HTMLElement = document.documentElement): () => void {
	marks.set(root, (marks.get(root) ?? 0) + 1);
	root.toggleAttribute('data-board-shown', true);
	let done = false;
	return () => {
		if (done) return;
		done = true;
		const left = (marks.get(root) ?? 1) - 1;
		marks.set(root, left);
		if (left === 0) root.removeAttribute('data-board-shown');
	};
}
