/**
 * Whether a sheet or dialog is open over the board (moving backgrounds, plan L113). The board
 * blurs behind every one (board-cover.ts), so a full-screen scene rests until it closes. The
 * same test is in SceneLayer.svelte's CSS, for the CSS scenes.
 */
const COVERED = ":root[data-board-shown]:has([data-part='backdrop'][data-state='open'])";

export function boardCovered(): boolean {
	try {
		return document.documentElement.matches(COVERED);
	} catch {
		// A browser without :has() keeps the scene moving.
		return false;
	}
}
