<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { navDrawer } from './nav-drawer.svelte.ts';
</script>

<!--
	The hamburger: opens and closes the sidebar on wide screens, the drawer otherwise. At the top
	of the sidebar, or before the page's title while no sidebar shows (Page); a game screen mounts
	it at the far left of its own toolbar, and leaving
	the game through the menu asks first (setLeaveGuard in shell.ts).
-->
<IconButton
	icon="menu"
	label={t('shell.navLabel')}
	aria-expanded={navDrawer.expanded}
	onclick={() => navDrawer.toggle()}
/>
