<script lang="ts">
	import { onMount } from 'svelte';
	import { account } from '#lib/features/account/account.svelte.ts';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import {
		clearCache,
		clearDatabases,
		clearEverything,
		GAMES_DB,
		NOTES_DB,
		reloadApp,
		SCRIPTS_DB,
		storageUse,
		type StorageUse
	} from '../data/device-data.ts';
	import ResetSection from './ResetSection.svelte';

	interface DataAction {
		id: string;
		label: MessageKey;
		description: MessageKey;
		title: MessageKey;
		confirm: MessageKey;
		/** Red: removes something the user made (Trevor: destructive actions in red). */
		danger: boolean;
		run: () => Promise<void>;
	}

	const ACTIONS: DataAction[] = [
		{
			id: 'cache',
			label: 'settings.clearCache',
			description: 'settings.clearCacheHelp',
			title: 'settings.clearCacheTitle',
			confirm: 'settings.clearCacheConfirm',
			danger: false,
			run: clearCache
		},
		{
			id: 'games',
			label: 'settings.clearGames',
			description: 'settings.clearGamesHelp',
			title: 'settings.clearGamesTitle',
			confirm: 'settings.clearGamesConfirm',
			danger: true,
			run: () => clearDatabases([GAMES_DB])
		},
		{
			id: 'notes',
			label: 'settings.clearNotes',
			description: 'settings.clearNotesHelp',
			title: 'settings.clearNotesTitle',
			confirm: 'settings.clearNotesConfirm',
			danger: true,
			run: () => clearDatabases([NOTES_DB])
		},
		{
			id: 'scripts',
			label: 'settings.clearScripts',
			description: 'settings.clearScriptsHelp',
			title: 'settings.clearScriptsTitle',
			confirm: 'settings.clearScriptsConfirm',
			danger: true,
			run: () => clearDatabases([SCRIPTS_DB])
		},
		{
			id: 'all',
			label: 'settings.clearAll',
			description: 'settings.clearAllHelp',
			title: 'settings.clearAllTitle',
			confirm: 'settings.clearAllConfirm',
			danger: true,
			run: async () => {
				if (account.status === 'signed-in') await account.signOut().catch(() => {});
				await clearEverything();
			}
		}
	];

	/** `t` for the keys above, none of which take placeholders. */
	const text = (key: MessageKey): string => (t as (key: MessageKey) => string)(key);

	let use = $state<StorageUse | null>(null);
	let pending = $state<DataAction | null>(null);
	let confirmOpen = $state(false);
	let working = $state(false);

	onMount(() => {
		void storageUse().then((value) => (use = value));
	});

	function size(bytes: number | null | undefined): string {
		if (use === null) return '…';
		if (bytes === null || bytes === undefined) return t('settings.storageUnknown');
		const mb = bytes / 1_000_000;
		return mb >= 0.1
			? intl.number(mb, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 })
			: intl.number(bytes / 1000, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 });
	}

	function ask(action: DataAction) {
		pending = action;
		confirmOpen = true;
	}

	async function confirm() {
		if (!pending || working) return;
		working = true;
		await pending.run();
		reloadApp();
	}
</script>

<!-- Fixed rows: the sizes arrive a moment later in the same places, so nothing moves. -->
<SettingRow label={t('settings.storageUsed')}>
	{#snippet control()}
		<dl class="use" data-testid="storage-use">
			<dt>{t('settings.storageTotal')}</dt>
			<dd>{size(use?.total)}</dd>
			<dt>{t('settings.storageSaved')}</dt>
			<dd>{size(use?.saved)}</dd>
			<dt>{t('settings.storageOffline')}</dt>
			<dd>{size(use?.offline)}</dd>
		</dl>
	{/snippet}
</SettingRow>

<ResetSection />

{#each ACTIONS as action (action.id)}
	<SettingRow label={text(action.label)} description={text(action.description)}>
		{#snippet control(labelId)}
			<Button
				variant={action.danger ? 'danger-quiet' : 'quiet'}
				icon={action.danger ? 'remove' : 'undo'}
				aria-describedby={labelId}
				onclick={() => ask(action)}
			>
				{text(action.label)}
			</Button>
		{/snippet}
	</SettingRow>
{/each}

<Dialog bind:open={confirmOpen} role="alertdialog" title={pending ? text(pending.title) : ''}>
	{#if pending}<p>{text(pending.confirm)}</p>{/if}
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (confirmOpen = false)}>{t('common.cancel')}</Button>
		<Button variant={pending?.danger ? 'danger' : 'solid'} disabled={working} onclick={confirm}
			>{t('settings.confirm')}</Button
		>
	{/snippet}
</Dialog>

<style>
	.use {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-4);
		margin: 0;
	}
	.use dt {
		color: var(--on-surface-muted);
	}
	.use dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
</style>
