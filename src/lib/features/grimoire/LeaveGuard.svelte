<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import type { Game } from '#lib/core/model/index.ts';
	import { withinModeSession } from '#lib/features/modes/mode-screens.ts';
	import { setLeaveGuard } from '#lib/features/shell/shell.ts';
	import { wasReplaced } from '#lib/features/game/next-game.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';

	/**
	 * Leaving the board asks first, whether through the app's navigation or Back; the game stays
	 * saved either way. A spectator's board never asks.
	 */
	interface Props {
		game: Game;
		watching: boolean;
	}

	let { game, watching }: Props = $props();

	// ── Leaving: the navigation menu (or Back) asks first; the game stays saved ──
	let exitOpen = $state(false);
	let pendingLeave: (() => void) | undefined;
	let releaseGuard: (() => void) | undefined;
	$effect(() => {
		if (watching) return;
		const gameId = game.gameId;
		const release = setLeaveGuard(
			(leave) => {
				pendingLeave = leave;
				exitOpen = true;
			},
			// This board's screens, the other boards and pages of its mode, and the game that
			// Game info's New game just started in its place.
			(url) =>
				url.pathname.startsWith(`/grimoire/${gameId}`) ||
				withinModeSession(gameId, url) ||
				wasReplaced(gameId)
		);
		releaseGuard = release;
		return release;
	});
	// ── Back (Trevor, 2026-10-17): the browser's Back, a back swipe or Android's Back button ──
	// The board adds one history entry of its own. Back first lands on the entry under it,
	// still this page: an open sheet or dialog closes, or else the board asks as for any other
	// way out. The browser runs no code for a Back that leaves the app, so the extra entry is
	// what lets it ask.
	let trapped = false;
	// After the setup and day hash handling below, which replaces the entry's state.
	onMount(() => {
		if (watching) return;
		setTimeout(() => {
			if (!page.state.inGame) pushState('', { inGame: true });
			trapped = true;
		});
	});
	$effect(() => {
		const inGame = page.state.inGame;
		// Only the entry's state is watched: closing an overlay below reads other state.
		untrack(() => {
			if (inGame || !trapped) return;
			trapped = false;
			const overlay = document.querySelector(
				'[data-part="content"][data-state="open"]:is([data-scope="dialog"], [data-scope="drawer"])'
			);
			if (overlay) {
				// Escape closes the newest overlay (Ark's layer stack), as Back should. The entry
				// goes back on only once it has gone: Android's back swipe previews the entry under
				// as it looked when the next one went on, and showed the overlay again (the Glossary,
				// Trevor 2026-10-27). A second Back meanwhile still asks, as it leaves the page.
				overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
				void afterClosing(overlay).then(() => {
					if (page.state.inGame) return;
					pushState('', { inGame: true });
					trapped = true;
				});
				return;
			}
			pushState('', { inGame: true });
			trapped = true;
			// Past the board's own entry and the page under it, to wherever the game was opened from.
			pendingLeave = () => history.go(-2);
			exitOpen = true;
		});
	});
	/**
	 * Resolves once `overlay` has closed and a frame without it is on screen; at most a second,
	 * for one that stays open (a form that asks before closing).
	 */
	function afterClosing(overlay: Element): Promise<void> {
		const until = performance.now() + 1000;
		return new Promise((resolve) => {
			const check = () => {
				// Overlays unmount once their closing animation ends.
				if (!overlay.isConnected || performance.now() > until)
					requestAnimationFrame(() => resolve());
				else requestAnimationFrame(check);
			};
			requestAnimationFrame(check);
		});
	}
	function confirmLeave() {
		exitOpen = false;
		const leave = pendingLeave;
		pendingLeave = undefined;
		// Confirmed: nothing more to ask on the way out.
		releaseGuard?.();
		leave?.();
	}
</script>

<ConfirmDialog bind:open={exitOpen} title="Leave the game?" onConfirm={confirmLeave}>
	<dl class="change">
		<dt>Now</dt>
		<dd>In the grimoire for {game.script.meta?.name ?? 'this game'}</dd>
		<dt>Becomes</dt>
		<dd>The game stays saved and opens again from Resume game.</dd>
	</dl>
</ConfirmDialog>

<style>
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0;
	}
	.change dt {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.change dd {
		margin: 0;
	}
</style>
