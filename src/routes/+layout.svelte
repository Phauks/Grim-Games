<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import type { Component } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import '#lib/ui/base.css';
	import UpdateBanner from '#lib/features/about/UpdateBanner.svelte';
	import GlossaryPopover from '#lib/features/glossary/GlossaryPopover.svelte';
	import { startAccount } from '#lib/features/account/start.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import { loadAfresh, staleBuild } from '#lib/features/offline/stale-build.svelte.ts';
	import { keepData } from '#lib/features/settings/data/keep-data.ts';
	import { installApp } from '#lib/features/settings/install-app.svelte.ts';
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
	import { trackKeyboardInset } from '#lib/ui/keyboard-inset.ts';
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

	// Who is signed in, checked once for every page, including games.
	$effect(() => {
		void startAccount();
	});

	// Asks the browser, silently, not to clear saved games and settings to free up space
	// (Storage plan, Trevor 2026-10-18; always on, no setting, 2026-10-19).
	$effect(() => keepData());

	// Lifts dialogs above the on-screen keyboard (keyboard-inset.ts).
	$effect(() => trackKeyboardInset());

	// Holds the browser's install prompt for Settings' Install app button, which loads later.
	$effect(() => installApp.listen());

	// Settings is the largest part of the app most visits never open, so it isn't loaded
	// before the first paint: the browser fetches it when idle, or when Settings first opens
	// (initial load review, /mnt/project-files/initial-load/findings.md).
	let SettingsModal = $state<Component>();
	let loadingSettings: Promise<unknown> | undefined;
	function loadSettings(): Promise<unknown> {
		loadingSettings ??= import('#lib/features/settings/SettingsModal.svelte').then(
			(module) => (SettingsModal = module.default),
			(error: unknown) => {
				// Tried again next time (offline before the app was stored, say).
				loadingSettings = undefined;
				throw error;
			}
		);
		return loadingSettings;
	}
	$effect(() => {
		if (!settingsDialog.open) return;
		loadSettings().catch((error) => {
			settingsDialog.open = false;
			reportError(error, { area: 'settings' });
		});
	});
	$effect(() => {
		const warm = () => void loadSettings().catch(() => {});
		if ('requestIdleCallback' in window) {
			const id = requestIdleCallback(warm, { timeout: 5000 });
			return () => cancelIdleCallback(id);
		}
		const id = setTimeout(warm, 3000);
		return () => clearTimeout(id);
	});

	// A game in progress or a bag draw asks before any navigation leaves it (shell.ts).
	beforeNavigate((navigation) => {
		const to = navigation.to?.url ?? null;
		if (!to) return;
		if (mustAskBeforeLeaving(new URL(to.href), navigation.type, new URL(page.url.href))) {
			navigation.cancel();
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- an app URL SvelteKit resolved
			leaveTo(() => void goto(to.href));
			return;
		}
		// This build's files are gone (a newer build replaced them): the page loads afresh, on the
		// build the service worker holds, instead of failing (stale-build.svelte.ts).
		if (staleBuild.current && navigation.type !== 'leave' && loadAfresh(to.href)) {
			navigation.cancel();
		}
	});

	// A game in progress hides the sidebar (src/lib/features/shell/shell.ts), and so
	// does a locked draw while the phone is passed round.
	const shell = $derived(
		showsAppShell(page.data) && !lockedDrawHidesShell(page.url.pathname, drawLock.lockedGame)
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{APP_NAME}</title>
</svelte:head>

<div class="app-body" class:bare={!shell}>
	{#if shell}<AppNav />{/if}
	<div class="app-main">{@render children()}</div>
</div>

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
	/* Clear of the phone's status and navigation bars: there is no app header (2026-10-22) or
	   footer (2026-10-23). */
	.app-body {
		padding-block: var(--app-top) env(safe-area-inset-bottom);
	}
	/* The status bar's strip keeps the theme's colour while the page scrolls under it (an
	   installed app on iPhone draws the page there; zero high elsewhere). */
	.app-body::before {
		content: '';
		position: fixed;
		inset: 0 0 auto;
		z-index: var(--z-raised);
		height: var(--app-top);
		background: var(--surface);
	}
	.app-main {
		flex: 1;
		min-width: 0;
	}
</style>
