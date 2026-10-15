<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import '#lib/ui/base.css';
	import AppFooter from '#lib/features/about/AppFooter.svelte';
	import UpdateBanner from '#lib/features/about/UpdateBanner.svelte';
	import SettingsModal from '#lib/features/settings/SettingsModal.svelte';
	import AppHeader from '#lib/features/shell/AppHeader.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Toaster from '#lib/ui/primitives/Toaster.svelte';
	import { applyAppearance } from '#lib/ui/themes/apply.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Before the first render, and again whenever the theme or a preference changes.
	$effect.pre(() => applyAppearance(preferences.theme, preferences.current));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Grim-Games</title>
</svelte:head>

<AppHeader />
<!-- Grows to fill the screen so the footer sits at the bottom on short pages. -->
<div class="app-main">{@render children()}</div>
<AppFooter />

<SettingsModal />
<Toaster />
<UpdateBanner />

<style>
	.app-main {
		flex: 1 0 auto;
		min-width: 0;
	}
</style>
