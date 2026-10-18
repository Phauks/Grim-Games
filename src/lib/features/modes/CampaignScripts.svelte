<script lang="ts">
	import { resolve } from '$app/paths';
	import { fromScript, scriptToJson, type GameData, type Script } from '#lib/core/data/index.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import ScriptView from '#lib/features/scripts/ScriptView.svelte';
	import { pickerRow } from '#lib/features/scripts/picker-rows.ts';
	import type { ScriptListing } from '#lib/features/scripts/script-providers.ts';
	import { shareTargetFor } from '#lib/features/scripts/share-codes.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import DataTable, { type DataColumn, type DataSort } from '#lib/ui/table/DataTable.svelte';
	import { campaigns, type Campaign } from './campaigns.ts';
	import { findMode } from './custom-modes.svelte.ts';

	/**
	 * The Library's Campaigns: a living script (Flesh and Bone) changes from game to game, and
	 * each version is kept and seen here (Trevor, 2026-10-18), one entry per campaign with its
	 * versions in the order played. Versions live in the campaign record, not among the saved
	 * scripts, so a long campaign doesn't push other scripts out. A table like the Library's
	 * own, even with none (Trevor, 2026-10-18: no different states).
	 */
	interface Props {
		data: GameData | undefined;
		/** The Library's search. */
		term?: string;
	}

	let { data, term = '' }: Props = $props();

	type ColumnId = 'name' | 'started';
	const all = campaigns();
	let sort = $state<DataSort<ColumnId> | undefined>();
	// Each column filters on its own value (the shared table filters every column).
	const columns = $derived<DataColumn<ColumnId, Campaign>[]>([
		{
			id: 'name',
			label: t('library.column.name'),
			sortable: true,
			flush: true,
			value: (c) => title(c)
		},
		{
			id: 'started',
			label: t('library.campaignStarted'),
			sortable: true,
			width: '30%',
			value: (c) => new Date(c.createdAt).toLocaleDateString()
		}
	]);
	const list = $derived.by(() => {
		const needle = term.trim().toLowerCase();
		const found = all.filter((c) => !needle || title(c).toLowerCase().includes(needle));
		if (!sort) return found;
		const sign = sort.direction === 'ascending' ? 1 : -1;
		return [...found].sort((a, b) =>
			sort?.column === 'name'
				? sign * title(a).localeCompare(title(b))
				: sign * (a.createdAt - b.createdAt)
		);
	});

	function onSort(column: ColumnId) {
		sort =
			sort?.column !== column
				? { column, direction: 'ascending' }
				: { column, direction: sort.direction === 'ascending' ? 'descending' : 'ascending' };
	}

	/** Each game's script: kept on the campaign, or read from the saved game for older records. */
	async function versions(c: Campaign, loaded: GameData): Promise<(Script | undefined)[]> {
		return Promise.all(
			c.games.map(async (g) => g.script ?? (await OpenGame.open(loaded, g.gameId))?.game.script)
		);
	}

	let opened = $state.raw<Campaign>();
	let scripts = $state.raw<(Script | undefined)[]>([]);
	let version = $state(0);
	let open = $state(false);

	async function show(c: Campaign) {
		if (!data) return;
		try {
			scripts = await versions(c, data);
			opened = c;
			version = c.games.length - 1;
			open = true;
		} catch (e) {
			reportError(e, { area: 'library' });
		}
	}

	function title(c: Campaign): string {
		return findMode(c.modeId)?.name ?? c.modeId;
	}

	const listing = $derived.by((): ScriptListing | undefined => {
		const script = scripts[version];
		if (!opened || !script || !data) return undefined;
		const loaded = fromScript(script, data).script;
		const source = { kind: 'campaign', campaignId: opened.campaignId, game: version + 1 } as const;
		const json = scriptToJson(loaded);
		return {
			row: pickerRow(
				loaded,
				`campaign:${opened.campaignId}:${version}`,
				'campaign',
				t('scripts.from.campaign', { number: version + 1 })
			),
			target: { kind: 'json', json, source },
			identity: { json }
		};
	});

	const options = $derived(
		scripts.map((s, i) => ({
			value: String(i),
			label: s?.meta?.name
				? `${t('modes.campaign.game', { number: i + 1 })} · ${s.meta.name}`
				: `${t('modes.campaign.game', { number: i + 1 })} · ${t('modes.campaign.gone')}`
		}))
	);
</script>

<div data-testid="library-campaigns">
	<DataTable
		label={t('library.campaigns')}
		{columns}
		rows={list}
		key={(c) => c.campaignId}
		{cell}
		{sort}
		{onSort}
		rowSelected={(c) => open && opened?.campaignId === c.campaignId}
		narrow="hide"
		empty={t('common.none')}
	/>
</div>

{#snippet cell(c: Campaign, column: DataColumn<ColumnId>)}
	{#if column.id === 'name'}
		<button type="button" class="pick" disabled={!data} onclick={() => void show(c)}>
			<span class="title">{title(c)}</span>
			<span class="sub">{t('library.campaignVersions', { count: c.games.length })}</span>
		</button>
	{:else}
		<span class="text">{new Date(c.createdAt).toLocaleDateString()}</span>
	{/if}
{/snippet}

<Dialog bind:open title={opened ? title(opened) : t('common.none')} size="full">
	<div class="dialog-scroll" data-testid="campaign-script-scroll">
		<div class="bar">
			<Select
				label={t('library.campaignVersion')}
				hideLabel
				value={String(version)}
				{options}
				onChange={(v) => (version = Number(v))}
			/>
			{#if opened}
				<Button
					icon="history"
					href={resolve('/campaigns/[campaignId]', { campaignId: opened.campaignId })}
				>
					{t('library.campaignOpen')}
				</Button>
			{/if}
		</div>
		{#if listing}
			{#key listing.row.key}
				{@const target = listing.target}
				<ScriptView
					{listing}
					{data}
					share={target.kind === 'json'
						? () => shareTargetFor({ json: target.json, source: target.source }, location.origin)
						: undefined}
				/>
			{/key}
		{:else}
			<p class="muted">{t('modes.campaign.gone')}</p>
		{/if}
	</div>
</Dialog>

<style>
	.pick {
		width: 100%;
		min-height: var(--tap-target);
		display: grid;
		align-content: center;
		padding: var(--space-1) var(--space-2);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.pick:hover {
		background: var(--surface-selected);
	}
	.title {
		font-weight: 600;
	}
	.text {
		display: flex;
		align-items: center;
		min-height: var(--tap-target);
		white-space: nowrap;
	}
	.sub,
	.muted {
		color: var(--on-surface-muted);
	}
	.sub {
		font-size: 0.8rem;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.dialog-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
</style>
