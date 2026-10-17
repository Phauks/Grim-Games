<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CccLogo from '#lib/features/about/CccLogo.svelte';
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
		<div class="nav-scroll">
			<NavList />
			<div class="bottom"><CccLogo /></div>
		</div>
	</nav>
{/if}

<style>
	.app-nav {
		display: none;
	}
	@media (min-width: 64rem) {
		/* The column runs the page's whole length, so its dividing line meets the footer's
		   wherever the page is scrolled (Trevor, 2026-10-16). */
		.app-nav {
			display: block;
			flex: none;
			width: calc(14 * var(--u));
			border-right: 1px solid var(--border);
		}
		/* The links stay in view below the header while the page scrolls. */
		.nav-scroll {
			position: sticky;
			top: calc(var(--tap-target) + env(safe-area-inset-top));
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			height: calc(100dvh - var(--tap-target) - env(safe-area-inset-top));
			overflow-y: auto;
			padding: var(--space-4) var(--space-2);
		}
		/* The Community Created Content logo, always at the bottom of the menu (Trevor, 2026-10-17). */
		.bottom {
			margin-top: auto;
		}
	}
</style>
