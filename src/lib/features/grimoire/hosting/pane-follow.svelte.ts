import { untrack } from 'svelte';
import { sidePane } from '#lib/features/room/side-pane.svelte.ts';
import type { NightWalk } from '#lib/features/grimoire/night/night-walk.svelte.ts';

/**
 * Keeps the Storyteller's pane on the game (Trevor, 2026-11-16: the grim as the home screen).
 * The Night tab is the walk-through's step: opening the step shows it, and on a phone closing
 * it (placing a token, Show the Grimoire) puts the board back. The pane turns to the Night tab
 * as a night starts and to the Day tab at dawn, unless another view is open. Call it while
 * a component starts, as its effects belong to that component.
 */
export function followGame(walk: NightWalk, isNight: () => boolean): void {
	$effect(() => {
		if (walk.guideOpen) sidePane.show('night');
		else if (!sidePane.beside && untrack(() => sidePane.shows('night'))) sidePane.hide();
	});
	$effect(() => {
		if (walk.guideOpen && !sidePane.shows('night')) walk.guideOpen = false;
	});
	// The tab is set before the pane draws, so a reload at night opens on the Night tab: the
	// tabs drew the Day's panel under a Night tab set once they were up.
	let shown: 'night' | 'day' = untrack(isNight) ? 'night' : 'day';
	if (sidePane.view === 'day' || sidePane.view === 'night') sidePane.turnTo(shown);
	$effect(() => {
		const now = isNight() ? 'night' : 'day';
		if (now === shown) return;
		shown = now;
		untrack(() => {
			if (sidePane.view === 'day' || sidePane.view === 'night') sidePane.turnTo(now);
		});
	});
}
