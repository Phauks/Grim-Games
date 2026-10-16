<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { navDrawer } from './nav-drawer.svelte.ts';
	import NavList from './NavList.svelte';
</script>

<!-- The same destinations as the sidebar, sliding in from the left (phones and game screens). -->
<Dialog bind:open={navDrawer.open} title={t('shell.navLabel')} size="side">
	<nav aria-label={t('shell.navLabel')}>
		<NavList withAccount onChoose={() => (navDrawer.open = false)} />
	</nav>
</Dialog>
