<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { navDrawer } from './nav-drawer.svelte.ts';
	import NavList from './NavList.svelte';

	// Lets the hamburger act on this sidebar rather than the drawer while it is on the page.
	$effect(() => {
		navDrawer.sidebarMounted = true;
		return () => (navDrawer.sidebarMounted = false);
	});
</script>

<!-- The left sidebar on wide screens, opened and closed by the header's hamburger. -->
{#if !navDrawer.hidden}
	<nav class="app-nav" aria-label={t('shell.navLabel')}>
		<NavList />
	</nav>
{/if}

<style>
	.app-nav {
		display: none;
	}
	@media (min-width: 64rem) {
		.app-nav {
			position: sticky;
			top: calc(var(--tap-target) + env(safe-area-inset-top));
			display: flex;
			flex: none;
			flex-direction: column;
			gap: var(--space-2);
			align-self: flex-start;
			width: calc(14 * var(--u));
			/* Always the full height below the header, so its dividing line reaches the bottom of
			   the screen whatever the page's length (Trevor, 2026-10-16). */
			height: calc(100dvh - var(--tap-target) - env(safe-area-inset-top));
			overflow-y: auto;
			padding: var(--space-4) var(--space-2);
			border-right: 1px solid var(--border);
		}
	}
</style>
