<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
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
		<a class="brand" href={resolve('/')}><span class="name">{APP_NAME}</span></a>
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
		min-width: 0;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		min-width: 0;
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 1.1rem;
		letter-spacing: 0.06em;
		color: var(--heading);
		text-decoration: none;
	}
	/* On the narrowest phones at the largest text the name gives way to the buttons; the
	   link stays a centring flex box so the name sits level with the icons. */
	.name {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		/* The name is all capitals: trim the line box to the capitals so it centres on the
		   icons by eye, not on room kept for descenders it never has (Trevor, 2026-10-18). */
		text-box: trim-both cap alphabetic;
		/* Room for round letters that overshoot the capitals, so the clip never cuts them. */
		padding-block: 0.1em;
	}
	.actions {
		display: flex;
		flex: none;
		gap: var(--space-1);
	}
</style>
