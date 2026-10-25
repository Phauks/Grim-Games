<script lang="ts">
	import { navDrawer } from './nav-drawer.svelte.ts';
	import NavMenuButton from './NavMenuButton.svelte';
</script>

<!-- The hamburger of a page with no sidebar showing, in its one spot on every screen: as far in
     from the top left as the sidebar's, the drawer's and a game toolbar's (--menu-inset; Trevor,
     2026-10-23: it sat somewhere else on each). Page reserves room for it before the title. -->
{#if navDrawer.pageButton}
	<div class="menu-spot"><NavMenuButton /></div>
{/if}

<style>
	.menu-spot {
		position: absolute;
		top: calc(var(--app-top) + var(--menu-inset));
		left: calc(env(safe-area-inset-left) + var(--menu-inset));
	}
</style>
