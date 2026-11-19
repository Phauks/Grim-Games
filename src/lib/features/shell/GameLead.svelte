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
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<span class="game-lead">
	<!-- The app's navigation, on every phone now More's place on the toolbar is free (Trevor,
	     2026-11-18). A spectator's page has the app's sidebar (Trevor, 2026-10-25), whose own
	     hamburger heads it. -->
	{#if !(navDrawer.sidebarMounted && !navDrawer.pageButton)}<NavMenuButton />{/if}
	{@render children?.()}
</span>

<style>
	.game-lead {
		display: flex;
		flex: none;
		align-items: center;
		gap: var(--menu-gap);
	}
</style>
