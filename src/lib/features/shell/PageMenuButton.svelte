<script lang="ts">
	import { navDrawer } from './nav-drawer.svelte.ts';
	import NavMenuButton from './NavMenuButton.svelte';
</script>

<!-- The hamburger for an app page that doesn't use Page (the spikes), shown while no sidebar
     does, as Page's title row has it: with no app header, every page reaches the menu. -->
{#if navDrawer.pageButton}<NavMenuButton />{/if}
