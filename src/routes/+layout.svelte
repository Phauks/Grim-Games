<script lang="ts">
	import { page } from '$app/state';
	import favicon from '#lib/assets/favicon.svg';
	import '#lib/ui/base.css';
	import AppFooter from '#lib/features/about/AppFooter.svelte';
	import UpdateBanner from '#lib/features/about/UpdateBanner.svelte';
	import GlossaryPopover from '#lib/features/glossary/GlossaryPopover.svelte';
	import SettingsModal from '#lib/features/settings/SettingsModal.svelte';
	import { startAccount } from '#lib/features/account/start.ts';
	import AppHeader from '#lib/features/shell/AppHeader.svelte';
	import { showsAppShell } from '#lib/features/shell/shell.ts';
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

	// A game in progress hides the header and footer (src/lib/features/shell/shell.ts).
	const shell = $derived(showsAppShell(page.data));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Grim-Games</title>
</svelte:head>

{#if shell}<AppHeader />{/if}
<!-- Grows to fill the screen so the footer sits at the bottom on short pages. -->
<div class="app-body">
	<div class="app-main">{@render children()}</div>
</div>
{#if shell}<AppFooter />{/if}

<SettingsModal />
<GlossaryPopover />
<Toaster />
<UpdateBanner />

<style>
	/* The sidebar (wide screens only) beside the page. */
	.app-body {
		display: flex;
		flex: 1 0 auto;
		min-width: 0;
	}
	.app-main {
		flex: 1;
		min-width: 0;
	}
</style>
