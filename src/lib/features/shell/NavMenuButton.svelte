<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { navDrawer } from './nav-drawer.svelte.ts';
</script>

<!--
	Opens the navigation drawer. In the header on narrow screens; a game screen mounts it in its
	own toolbar, and leaving the game through the drawer asks first (setLeaveGuard in shell.ts).
-->
<IconButton icon="menu" label={t('shell.navOpen')} onclick={() => navDrawer.show()} />
