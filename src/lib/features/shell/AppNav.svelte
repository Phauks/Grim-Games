<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CccLogo from '#lib/features/about/CccLogo.svelte';
	import { navDrawer } from './nav-drawer.svelte.ts';
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import { APP_NAME } from '#lib/core/app-name.ts';
	import NavList from './NavList.svelte';
	import NavMenuButton from './NavMenuButton.svelte';

	// Lets the hamburger act on this sidebar rather than the drawer while it is on the page.
	// Set before the page renders, so its title row knows at once whether to carry the
	// hamburger (no jump on the first frame).
	navDrawer.sidebarMounted = true;
	onDestroy(() => (navDrawer.sidebarMounted = false));
</script>

<!-- The left sidebar on wide screens. There is no app header (2026-10-22): the app's
     name and the hamburger that closes it head the sidebar, and Account and Settings end it. -->
{#if !navDrawer.hidden}
	<nav class="app-nav" aria-label={t('shell.navLabel')}>
		<div class="nav-scroll">
			<div class="brand-row">
				<NavMenuButton />
				<a class="brand" href={resolve('/')}><span class="name">{APP_NAME}</span></a>
			</div>
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
		/* The links stay in view while the page scrolls. */
		.nav-scroll {
			position: sticky;
			top: var(--app-top);
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			height: calc(100dvh - var(--app-top));
			overflow-y: auto;
			padding: var(--space-2) var(--space-2) var(--space-4);
		}
		/* The app's name beside the hamburger, where the header had them. */
		.brand-row {
			display: flex;
			align-items: center;
			gap: var(--space-1);
			margin-bottom: var(--space-2);
		}
		.brand {
			font-family: var(--font-heading);
			font-weight: var(--font-heading-weight);
			font-size: 1.1rem;
			letter-spacing: 0.06em;
			color: var(--heading);
			text-decoration: none;
			display: inline-flex;
			align-items: center;
		}
		/* All capitals: trim the line box to them so the name centres on the icon by eye. */
		.name {
			text-box: trim-both cap alphabetic;
			padding-block: 0.1em;
		}
		/* The Community Created Content logo, always at the bottom of the menu (Trevor, 2026-10-17). */
		.bottom {
			margin-top: auto;
		}
	}
</style>
