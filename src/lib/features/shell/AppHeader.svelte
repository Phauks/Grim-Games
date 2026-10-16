<script lang="ts">
	import NavMenuButton from './NavMenuButton.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { resolve } from '$app/paths';
	import AccountButton from '#lib/features/account/AccountButton.svelte';
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
</script>

<header>
	<div class="start">
		<span class="menu"><NavMenuButton /></span>
		<a class="brand" href={resolve('/')}>Grim-Games</a>
	</div>
	<div class="actions">
		<IconButton icon="settings" label={t('shell.settings')} onclick={() => settingsDialog.show()} />
		<!-- Mounted on every page: it also starts the signed-in check. -->
		<AccountButton />
	</div>
</header>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: var(--z-raised);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: env(safe-area-inset-top) var(--space-2) 0;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}
	.start {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 1.1rem;
		letter-spacing: 0.06em;
		color: var(--heading);
		text-decoration: none;
	}
	.actions {
		display: flex;
		gap: var(--space-1);
	}
</style>
