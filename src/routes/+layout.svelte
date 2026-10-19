<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { beforeNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import '#lib/ui/base.css';
	import AppFooter from '#lib/features/about/AppFooter.svelte';
	import UpdateBanner from '#lib/features/about/UpdateBanner.svelte';
	import GlossaryPopover from '#lib/features/glossary/GlossaryPopover.svelte';
	import SettingsModal from '#lib/features/settings/SettingsModal.svelte';
	import { startAccount } from '#lib/features/account/start.ts';
	import { keepData } from '#lib/features/settings/data/keep-data.ts';
	import AppHeader from '#lib/features/shell/AppHeader.svelte';
	import AppNav from '#lib/features/shell/AppNav.svelte';
	import NavDrawer from '#lib/features/shell/NavDrawer.svelte';
	import {
		leaveTo,
		lockedDrawHidesShell,
		mustAskBeforeLeaving,
		showsAppShell
	} from '#lib/features/shell/shell.ts';
	import { drawLock } from '#lib/features/setup/draw-lock.svelte.ts';
	import { locale } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Toaster from '#lib/ui/primitives/Toaster.svelte';
	import { applyAppearance } from '#lib/ui/themes/apply.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Before the first render, and again whenever the theme or a preference changes.
	$effect.pre(() => applyAppearance(preferences.theme, preferences.current));

	// The interface language for this device (English until another language exists).
	$effect(() => {
		void locale.init();
	});

	// Who is signed in, checked once for every page, including games without the header.
	$effect(() => {
		void startAccount();
	});

	// Asks the browser, silently, not to clear saved games and settings to free up space
	// (Storage plan, Trevor 2026-10-18; always on, no setting, 2026-10-19).
	$effect(() => keepData());

	// A game in progress or a bag draw asks before any navigation leaves it (shell.ts).
	beforeNavigate((navigation) => {
		const to = navigation.to?.url ?? null;
		if (!to || !mustAskBeforeLeaving(new URL(to.href), navigation.type, new URL(page.url.href)))
			return;
		navigation.cancel();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- an app URL SvelteKit resolved
		leaveTo(() => void goto(to.href));
	});

	// A game in progress hides the header and footer (src/lib/features/shell/shell.ts), and so
	// does a locked draw while the phone is passed round.
	const shell = $derived(
		showsAppShell(page.data) && !lockedDrawHidesShell(page.url.pathname, drawLock.lockedGame)
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{APP_NAME}</title>
</svelte:head>

{#if shell}<AppHeader />{/if}
<!-- Grows to fill the screen so the footer sits at the bottom on short pages. -->
<div class="app-body" class:bare={!shell}>
	{#if shell}<AppNav />{/if}
	<div class="app-main">{@render children()}</div>
</div>
{#if shell}<AppFooter />{/if}

<SettingsModal />
<NavDrawer />
<GlossaryPopover />
<Toaster />
<UpdateBanner />

<style>
	/* The sidebar (wide screens only) beside the page. */
	.app-body {
		display: flex;
		flex: 1 0 auto;
		min-width: 0;
		/* Clear of a landscape phone's notch (viewport-fit=cover in app.html). */
		padding-inline: env(safe-area-inset-left) env(safe-area-inset-right);
	}
	/* No header or footer (a game): clear of the status and navigation bars here instead. */
	.app-body.bare {
		padding-block: env(safe-area-inset-top) env(safe-area-inset-bottom);
	}
	.app-main {
		flex: 1;
		min-width: 0;
	}
</style>
