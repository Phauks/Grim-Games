<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { account } from '#lib/features/account/account.svelte.ts';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { formatBytes } from '#lib/i18n/bytes.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import DataTable, { type DataColumn, type DataSort } from '#lib/ui/table/DataTable.svelte';
	import { reloadApp, storageUse } from '../data/device-data.ts';
	import { dataKept, needsHomeScreen, thisBrowser } from '../data/keep-data.ts';
	import {
		clearItems,
		measureStorage,
		STORAGE_ITEM_IDS,
		totalBytes,
		type StorageItem,
		type StorageItemId
	} from '../data/storage-items.ts';

	type Column = 'select' | 'item' | 'size';

	/** `t` for keys built from an item id, none of which take placeholders. */
	const text = (key: string): string => (t as (key: MessageKey) => string)(key as MessageKey);
	const itemName = (id: StorageItemId) => text(`settings.storage.${id}`);
	const itemHelp = (id: StorageItemId) => text(`settings.storage.${id}Help`);

	// Rows are in place before they are measured, so nothing moves when the sizes arrive.
	let items = $state<StorageItem[]>(
		STORAGE_ITEM_IDS.map((id) => ({ id, bytes: null, clearable: id !== 'app', userData: false }))
	);
	let measured = $state(false);
	let browserTotal = $state<number | null | undefined>(undefined);
	const selected = new SvelteSet<StorageItemId>();
	let sort = $state<DataSort<Column> | undefined>();
	let confirmOpen = $state(false);
	let working = $state(false);

	// Whether the browser promised to keep the data (asked at startup, +layout.svelte).
	let kept = $state<boolean | null | undefined>(undefined);
	// Known before the first render, so the row never appears after the rest.
	const homeScreen = needsHomeScreen(thisBrowser());

	onMount(() => {
		void dataKept().then((value) => (kept = value));
		void measureStorage().then((value) => {
			items = value;
			measured = true;
		});
		void storageUse().then((use) => (browserTotal = use.total));
	});

	const columns = $derived<DataColumn<Column, StorageItem>[]>([
		{
			id: 'select',
			label: t('settings.storageSelect'),
			hideLabel: true,
			flush: true,
			fixed: true,
			width: 'var(--tap-target)',
			alwaysShown: true,
			noFilter: 'A tick box per row, for choosing what to clear.'
		},
		{
			id: 'item',
			label: t('settings.storageItem'),
			rowHeader: true,
			value: (item) => itemName(item.id)
		},
		{
			id: 'size',
			label: t('settings.storageSize'),
			align: 'end',
			sortable: true,
			width: 'calc(7 * var(--u))',
			value: (item) => size(item.bytes)
		}
	]);

	const rows = $derived.by(() => {
		if (sort?.column !== 'size') return items;
		const sign = sort.direction === 'ascending' ? 1 : -1;
		return [...items].sort((a, b) => sign * ((a.bytes ?? 0) - (b.bytes ?? 0)));
	});

	const clearable = $derived(items.filter((item) => item.clearable));
	const allSelected = $derived(clearable.length > 0 && clearable.every((i) => selected.has(i.id)));
	const chosen = $derived(items.filter((item) => selected.has(item.id)));
	const destructive = $derived(chosen.some((item) => item.userData));

	function onSort(column: Column) {
		if (column !== 'size') return;
		sort =
			sort?.direction === 'descending'
				? { column, direction: 'ascending' }
				: { column, direction: 'descending' };
	}

	function toggle(id: StorageItemId, on: boolean) {
		if (on) selected.add(id);
		else selected.delete(id);
	}

	function toggleAll(on: boolean) {
		for (const item of clearable) toggle(item.id, on);
	}

	function size(bytes: number | null | undefined, ready = measured): string {
		if (!ready || bytes === undefined) return '…';
		if (bytes === null) return t('settings.storageUnknown');
		return formatBytes(bytes);
	}

	async function confirm() {
		if (working || chosen.length === 0) return;
		working = true;
		// Everything the user can clear: sign out too, as a clean start (Trevor, 2026-10-16).
		if (allSelected && account.status === 'signed-in') await account.signOut().catch(() => {});
		await clearItems(new Set(selected));
		reloadApp();
	}
</script>

<SettingRow label={t('settings.dataKept')} description={t('settings.dataKeptHelp')}>
	{#snippet control()}
		<span class="kept" data-testid="data-kept"
			>{kept === undefined
				? '…'
				: kept === null
					? t('settings.storageUnknown')
					: kept
						? t('settings.dataKeptYes')
						: t('settings.dataKeptNo')}</span
		>
	{/snippet}
</SettingRow>
{#if homeScreen}
	<!-- Safari only; a row here, never a banner or popup (Trevor bars both). -->
	<SettingRow
		layout="stacked"
		label={t('settings.homeScreen')}
		description={t('settings.homeScreenHelp')}
	>
		{#snippet control()}
			<p class="steps" data-testid="home-screen-steps">{t('settings.homeScreenSteps')}</p>
		{/snippet}
	</SettingRow>
{/if}
<SettingRow
	layout="stacked"
	label={t('settings.storageUsed')}
	description={t('settings.storageUsedHelp')}
>
	{#snippet control()}
		<div class="tools">
			<label class="all">
				<input
					type="checkbox"
					checked={allSelected}
					indeterminate={selected.size > 0 && !allSelected}
					onchange={(event) => toggleAll(event.currentTarget.checked)}
				/>
				{t('settings.storageSelectAll')}
			</label>
			<DeleteButton
				label={t('settings.storageClearSelected')}
				disabled={selected.size === 0}
				onclick={() => (confirmOpen = true)}
			/>
		</div>
		<DataTable
			label={t('settings.storageTable')}
			{columns}
			{rows}
			key={(item) => item.id}
			{sort}
			{onSort}
			testid="storage-table"
		>
			{#snippet cell(item, column)}
				{#if column.id === 'select'}
					<label class="pick">
						<input
							type="checkbox"
							aria-label={t('settings.storageSelectRow', { item: itemName(item.id) })}
							checked={selected.has(item.id)}
							disabled={!item.clearable}
							onchange={(event) => toggle(item.id, event.currentTarget.checked)}
						/>
					</label>
				{:else if column.id === 'item'}
					<span class="name">{itemName(item.id)}</span>
					<span class="help">{itemHelp(item.id)}</span>
				{:else}
					<span class="size">{size(item.bytes)}</span>
				{/if}
			{/snippet}
		</DataTable>
		<dl class="totals" data-testid="storage-use">
			<dt>{t('settings.storageMeasured')}</dt>
			<dd>{size(totalBytes(items))}</dd>
			<dt>{t('settings.storageBrowser')}</dt>
			<dd>{size(browserTotal, browserTotal !== undefined)}</dd>
		</dl>
	{/snippet}
</SettingRow>

<ConfirmDialog
	bind:open={confirmOpen}
	title={t('settings.storageClearTitle')}
	danger={destructive}
	disabled={working}
	onConfirm={confirm}
>
	<p>{t('settings.storageClearText')}</p>
	<ul>
		{#each chosen as item (item.id)}<li>{itemName(item.id)}</li>{/each}
	</ul>
	{#if allSelected && account.status === 'signed-in'}<p>{t('settings.storageSignOut')}</p>{/if}
</ConfirmDialog>

<style>
	.kept {
		font-weight: 600;
	}
	.steps {
		margin: 0;
	}
	.tools {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}
	.all,
	.pick {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		cursor: pointer;
	}
	.pick {
		justify-content: center;
		width: 100%;
		height: 100%;
	}
	input[type='checkbox'] {
		width: 1.2em;
		height: 1.2em;
		margin: 0;
		accent-color: var(--accent);
	}
	.name {
		display: block;
	}
	.help {
		display: block;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	.size,
	.totals dd {
		font-variant-numeric: tabular-nums;
	}
	.totals {
		display: grid;
		grid-template-columns: auto auto;
		justify-content: end;
		gap: var(--space-1) var(--space-4);
		margin: var(--space-2) 0 0;
	}
	.totals dt {
		color: var(--on-surface-muted);
	}
	.totals dd {
		margin: 0;
		text-align: end;
	}
</style>
