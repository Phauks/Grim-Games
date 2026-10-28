<script lang="ts">
	import type { Snippet } from 'svelte';
	import NavMenuButton from './NavMenuButton.svelte';
	import { navDrawer } from './nav-drawer.svelte.ts';

	/**
	 * ☰ and what sits beside it (the grim cover), at the top left of the board's toolbar and
	 * of the day's sheet alike, so neither moves between the two (Trevor, 2026-10-28). The
	 * spacing is --menu-gap; Dialog's `screen` size puts its lead at the toolbar's spot.
	 */
	interface Props {
		/** A spectator's board, which has no More to hold ☰ on the narrowest phones. */
		watching?: boolean;
		children?: Snippet;
	}

	let { watching = false, children }: Props = $props();
</script>

<span class="game-lead">
	<!-- The app's navigation; on the narrowest phones it is in More instead. A spectator's
	     page has the app's sidebar (Trevor, 2026-10-25), whose own hamburger heads it. -->
	{#if !(navDrawer.sidebarMounted && !navDrawer.pageButton)}<span class="nav-menu" class:watching
			><NavMenuButton /></span
		>{/if}
	{@render children?.()}
</span>

<style>
	.game-lead {
		display: flex;
		flex: none;
		align-items: center;
		gap: var(--menu-gap);
	}
	.nav-menu {
		display: contents;
	}
	@media (max-width: 359.98px) {
		/* Without More, a viewer's navigation stays on the toolbar; the others find it in More. */
		.nav-menu:not(.watching) {
			display: none;
		}
	}
</style>
