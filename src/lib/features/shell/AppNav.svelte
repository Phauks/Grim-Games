<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import NavList from './NavList.svelte';

	const KEY = 'grim-games:nav-collapsed';

	function readCollapsed(): boolean {
		try {
			return globalThis.localStorage?.getItem(KEY) === '1';
		} catch {
			return false;
		}
	}

	let collapsed = $state(readCollapsed());

	function toggle() {
		collapsed = !collapsed;
		try {
			if (collapsed) localStorage.setItem(KEY, '1');
			else localStorage.removeItem(KEY);
		} catch {
			// Storage blocked: the choice lasts for this visit.
		}
	}
</script>

<!-- The left sidebar on wide screens; phones use the drawer from the header's menu button. -->
<nav class="app-nav" class:collapsed aria-label={t('shell.navLabel')}>
	<NavList compact={collapsed} />
	<div class="toggle">
		<IconButton
			icon={collapsed ? 'forward' : 'back'}
			label={collapsed ? t('shell.navExpand') : t('shell.navCollapse')}
			aria-expanded={!collapsed}
			onclick={toggle}
		/>
	</div>
</nav>

<style>
	.app-nav {
		display: none;
	}
	@media (min-width: 64rem) {
		.app-nav {
			position: sticky;
			top: calc(var(--tap-target) + env(safe-area-inset-top));
			display: flex;
			flex: none;
			flex-direction: column;
			gap: var(--space-2);
			align-self: flex-start;
			width: calc(14 * var(--u));
			max-height: calc(100dvh - var(--tap-target));
			overflow-y: auto;
			padding: var(--space-4) var(--space-2);
			border-right: 1px solid var(--border);
		}
		.collapsed {
			width: calc(var(--tap-target) + 2 * var(--space-2));
		}
	}
	.toggle {
		display: flex;
		justify-content: flex-end;
	}
	.collapsed .toggle {
		justify-content: center;
	}
</style>
