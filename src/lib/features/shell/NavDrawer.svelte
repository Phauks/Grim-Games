<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import CccLogo from '#lib/features/about/CccLogo.svelte';
	import { navDrawer } from './nav-drawer.svelte.ts';
	import NavList from './NavList.svelte';
</script>

<!-- The same destinations as the sidebar, sliding in from the left (phones and game screens). -->
<Dialog bind:open={navDrawer.open} title={t('shell.navLabel')} size="side" closeButton={false}>
	{#snippet lead()}
		<!-- Where the hamburger that opened it was, so the same spot closes it. -->
		<IconButton
			icon="menu"
			label={t('shell.navClose')}
			aria-expanded="true"
			onclick={() => (navDrawer.open = false)}
		/>
	{/snippet}
	<nav class="drawer-nav" aria-label={t('shell.navLabel')}>
		<NavList withAccount onChoose={() => (navDrawer.open = false)} />
	</nav>
	<!-- The Community Created Content logo, always at the bottom of the menu (Trevor, 2026-10-17). -->
	<div class="bottom"><CccLogo /></div>
</Dialog>

<style>
	.drawer-nav {
		margin-top: var(--space-4);
	}
	.bottom {
		margin-top: var(--space-6);
	}
</style>
