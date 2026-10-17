<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { isSeatable, type GameData } from '#lib/core/data/index.ts';
	import { account } from '#lib/features/account/account.svelte.ts';
	import { profileScripts } from '#lib/features/account/profile-scripts.svelte.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import InfoTokensPanel from '#lib/features/info-tokens/InfoTokensPanel.svelte';
	import {
		forgetScript,
		recentScripts,
		restoreScripts
	} from '#lib/features/scripts/current-script.svelte.ts';
	import { describeSource, sameScript, sourcePage } from '#lib/features/scripts/saved-scripts.ts';
	import {
		localListings,
		profileProvider,
		recentProvider,
		type ScriptListing
	} from '#lib/features/scripts/script-providers.ts';
	import ScriptDetails from '#lib/features/scripts/ScriptDetails.svelte';
	import { shareTargetFor, type Shareable } from '#lib/features/scripts/share-codes.ts';
	import ShareControl from '#lib/features/scripts/ShareControl.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import DataTable, { type DataColumn, type DataSort } from '#lib/ui/table/DataTable.svelte';
	import LabelManager from './LabelManager.svelte';
	import NewLabel from './NewLabel.svelte';
	import { byName, filterLibrary, libraryKey, type FolderFilter } from './library-labels.ts';
	import { libraryLabels } from './library-labels.svelte.ts';

	/**
	 * Everything the user has kept (Trevor, 2026-10-16: "any scripts the user has built or
	 * downloaded or saved, along with any tags or functionality they have created"): their saved
	 * and profile scripts with their own folders and tags, and their own info tokens. It reads
	 * the Scripts and Info tokens features' stores; nothing is copied.
	 */

	let data = $state.raw<GameData>();

	onMount(() => {
		void restoreScripts();
		loadOfficialData().then(
			(d) => (data = d),
			(e) => reportError(e, { area: 'library', notify: false })
		);
	});

	// A signed-in user's profile scripts are theirs too (fetched once; the Account page refreshes).
	$effect(() => {
		if (account.user && profileScripts.status === 'idle') void profileScripts.refresh();
	});

	interface Row {
		key: string;
		haystack: string;
		listing: ScriptListing;
		shareable: Shareable;
	}

	const rows = $derived.by<Row[]>(() => {
		if (!data) return [];
		const profile = account.user ? profileScripts.list : [];
		return localListings(
			{
				data,
				curated: [],
				recent: recentScripts.list,
				profile,
				curatedLabel: (s) => s,
				describe: describeSource
			},
			[recentProvider, profileProvider]
		).flatMap((listing) => {
			const identity = listing.identity;
			if (!identity) return [];
			const shareable: Shareable | undefined =
				listing.saved ??
				(listing.target.kind === 'json'
					? { json: listing.target.json, source: listing.target.source }
					: undefined);
			return shareable
				? [{ key: libraryKey(identity), haystack: listing.row.haystack, listing, shareable }]
				: [];
		});
	});

	// ---- Search, filters and sort ----

	let term = $state('');
	let folderFilter = $state<string>('all');
	let tagFilter = $state<string[]>([]);
	type ColumnId = 'name' | 'folder' | 'tags' | 'source';
	let sort = $state<DataSort<ColumnId> | undefined>();

	const folders = $derived(byName(libraryLabels.state.folders));
	const tags = $derived(byName(libraryLabels.state.tags));
	const folderName = (id: string | undefined) =>
		id ? (folders.find((f) => f.id === id)?.name ?? '') : '';
	const tagNames = (ids: readonly string[]) =>
		tags.filter((tag) => ids.includes(tag.id)).map((tag) => tag.name);
	const sourceOf = (row: Row) =>
		row.listing.row.note || t(`scripts.sourceLabel.${row.listing.row.source}`);

	// A folder or tag deleted elsewhere drops out of the filter.
	const folder = $derived<FolderFilter>(
		folderFilter === 'all'
			? { kind: 'all' }
			: folderFilter === 'none'
				? { kind: 'none' }
				: folders.some((f) => f.id === folderFilter)
					? { kind: 'folder', id: folderFilter }
					: { kind: 'all' }
	);
	const activeTags = $derived(tagFilter.filter((id) => tags.some((tag) => tag.id === id)));

	const shown = $derived.by(() => {
		const list = filterLibrary(rows, libraryLabels.state, {
			term,
			folder,
			tags: activeTags
		});
		if (!sort) return list;
		const { column, direction } = sort;
		const text = (row: Row) => {
			const labels = libraryLabels.for(row.key);
			if (column === 'folder') return folderName(labels.folder);
			if (column === 'tags') return tagNames(labels.tags).join(', ');
			if (column === 'source') return sourceOf(row);
			return row.listing.row.name;
		};
		const sign = direction === 'ascending' ? 1 : -1;
		// Blank values sort last either way.
		return [...list].sort((a, b) => {
			const x = text(a);
			const y = text(b);
			if (!x !== !y) return x ? -1 : 1;
			return sign * x.localeCompare(y, undefined, { sensitivity: 'base', numeric: true });
		});
	});

	function onSort(column: ColumnId) {
		sort =
			sort?.column !== column
				? { column, direction: 'ascending' }
				: sort.direction === 'ascending'
					? { column, direction: 'descending' }
					: undefined;
	}

	const columns = $derived<DataColumn<ColumnId>[]>([
		{ id: 'name', label: t('library.column.name'), sortable: true, flush: true },
		{
			id: 'folder',
			label: t('library.column.folder'),
			sortable: true,
			wide: true,
			width: '22%',
			filterable: true,
			filtered: folder.kind !== 'all'
		},
		{
			id: 'tags',
			label: t('library.column.tags'),
			sortable: true,
			wide: true,
			width: '26%',
			filterable: true,
			filtered: activeTags.length > 0
		},
		{ id: 'source', label: t('library.column.source'), sortable: true, wide: true, width: '18%' }
	]);

	const folderOptions = $derived([
		{ value: 'all', label: t('library.folderAll') },
		{ value: 'none', label: t('library.folderNone') },
		...folders.map((f) => ({ value: f.id, label: f.name }))
	]);

	// ---- One script's dialog: its folder, tags, details, Share and Remove ----

	let openKey = $state<string>();
	let scriptOpen = $state(false);
	let removing = $state(false);
	const openRow = $derived(rows.find((row) => row.key === openKey));
	const openLabels = $derived(openKey ? libraryLabels.for(openKey) : { tags: [] });

	function openScript(row: Row) {
		openKey = row.key;
		scriptOpen = true;
	}

	const scriptFolderOptions = $derived([
		{ value: '', label: t('common.none') },
		...folders.map((f) => ({ value: f.id, label: f.name }))
	]);

	async function removeOpen() {
		const row = openRow;
		if (!row) return;
		scriptOpen = false;
		const identity = row.listing.identity;
		try {
			if (row.listing.saved) await forgetScript(row.listing.saved.scriptId);
			if (account.user && identity) {
				for (const entry of profileScripts.list) {
					if (sameScript({ json: entry.script.json }, identity)) {
						await profileScripts.remove(entry);
					}
				}
			}
		} catch (e) {
			reportError(e, { area: 'library' });
		}
	}

	let manageOpen = $state(false);

	const characters = $derived(
		officialData.current?.characters.filter((c) => isSeatable(c.type)) ?? []
	);
</script>

<main>
	<div class="head">
		<h1>{t('library.heading')}</h1>
		<Button icon="tag" onclick={() => (manageOpen = true)}>{t('library.manage')}</Button>
	</div>

	<ErrorBoundary area="library">
		<section aria-labelledby="library-scripts">
			<h2 id="library-scripts">{t('library.scripts')}</h2>
			<label class="term">
				<span class="visually-hidden">{t('library.search')}</span>
				<input
					type="search"
					autocomplete="off"
					enterkeyhint="search"
					placeholder={t('library.searchPlaceholder')}
					bind:value={term}
				/>
			</label>
			<div data-testid="library-table">
				<DataTable
					label={t('library.table')}
					{columns}
					rows={shown}
					key={(row) => row.key}
					{cell}
					{sort}
					{onSort}
					{filter}
					narrow="hide"
					empty={t('common.none')}
				/>
			</div>
		</section>

		<section aria-labelledby="library-info-tokens">
			<h2 id="library-info-tokens">{t('library.infoTokens')}</h2>
			<InfoTokensPanel {characters} only="custom" level={3} />
		</section>
	</ErrorBoundary>
</main>

{#snippet labelList(labels: readonly string[])}
	{#each labels as name (name)}<span class="chip">{name}</span>{:else}<span class="muted"
			>{t('common.none')}</span
		>{/each}
{/snippet}

{#snippet cell(row: Row, column: DataColumn<ColumnId>)}
	{@const labels = libraryLabels.for(row.key)}
	{#if column.id === 'name'}
		<button type="button" class="pick" onclick={() => openScript(row)}>
			<span class="title">{row.listing.row.name || t('common.none')}</span>
			<span class="sub"
				>{[
					row.listing.row.author,
					folderName(labels.folder),
					tagNames(labels.tags).join(', '),
					sourceOf(row)
				]
					.filter(Boolean)
					.join(' · ')}</span
			>
		</button>
	{:else if column.id === 'folder'}
		<span class="text">{folderName(labels.folder) || t('common.none')}</span>
	{:else if column.id === 'tags'}
		<span class="chips">{@render labelList(tagNames(labels.tags))}</span>
	{:else}
		<span class="text">{sourceOf(row)}</span>
	{/if}
{/snippet}

{#snippet filter(column: DataColumn<ColumnId>, close: () => void)}
	<div class="filters">
		{#if column.id === 'folder' || column.id === 'name'}
			<fieldset>
				<legend>{t('library.column.folder')}</legend>
				{#each folderOptions as option (option.value)}
					<label class="check">
						<input
							type="radio"
							name="library-folder"
							value={option.value}
							checked={folderFilter === option.value ||
								(option.value === 'all' && folder.kind === 'all')}
							onchange={() => {
								folderFilter = option.value;
								close();
							}}
						/>
						{option.label}
					</label>
				{/each}
			</fieldset>
		{/if}
		{#if column.id === 'tags' || column.id === 'name'}
			<fieldset>
				<legend>{t('library.tagFilter')}</legend>
				{#each tags as tag (tag.id)}
					<label class="check">
						<input
							type="checkbox"
							checked={activeTags.includes(tag.id)}
							onchange={() =>
								(tagFilter = activeTags.includes(tag.id)
									? activeTags.filter((id) => id !== tag.id)
									: [...activeTags, tag.id])}
						/>
						{tag.name}
					</label>
				{:else}
					<p class="muted">{t('common.none')}</p>
				{/each}
			</fieldset>
		{/if}
	</div>
{/snippet}

<Dialog bind:open={scriptOpen} title={openRow?.listing.row.name || t('common.none')} size="full">
	{#if openRow && openKey}
		{@const key = openKey}
		<div class="labels" data-testid="script-labels">
			<Select
				label={t('library.folder')}
				value={openLabels.folder ?? ''}
				options={scriptFolderOptions}
				onChange={(value) => libraryLabels.setFolder(key, value || undefined)}
			/>
			<fieldset class="tag-toggles">
				<legend>{t('library.tags')}</legend>
				<div class="toggles">
					{#each tags as tag (tag.id)}
						<button
							type="button"
							class="tag-toggle"
							aria-pressed={openLabels.tags.includes(tag.id)}
							onclick={() => libraryLabels.toggleTag(key, tag.id)}>{tag.name}</button
						>
					{/each}
				</div>
				<NewLabel
					kind="tags"
					label={t('library.newTag')}
					onadd={(id) => libraryLabels.toggleTag(key, id)}
				/>
			</fieldset>
		</div>
		<ScriptDetails
			heading={t('library.details')}
			name={openRow.listing.row.name}
			facts={[
				{
					label: t('library.author'),
					value: openRow.listing.row.author || t('common.none')
				},
				{
					label: t('library.source'),
					value: sourceOf(openRow),
					href: sourcePage(openRow.shareable.source)
				}
			]}
			entries={openRow.listing.row.entries}
			{data}
		>
			{#snippet actions()}
				{@const shareable = openRow.shareable}
				<ShareControl
					what="script"
					title={openRow.listing.row.name || t('common.none')}
					target={() => shareTargetFor(shareable, location.origin)}
				/>
				<span class="danger">
					<IconButton icon="remove" label={t('library.remove')} onclick={() => (removing = true)} />
				</span>
			{/snippet}
		</ScriptDetails>
	{/if}
</Dialog>

<ConfirmDialog
	bind:open={removing}
	title={t('library.removeConfirm')}
	danger
	onConfirm={() => void removeOpen()}
>
	<p>{t('library.removeBody', { name: openRow?.listing.row.name || t('common.none') })}</p>
</ConfirmDialog>

<LabelManager bind:open={manageOpen} />

<style>
	main {
		max-width: var(--page-max);
		margin: 0 auto;
		padding: var(--space-5) var(--page-gutter);
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-5);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	h1 {
		margin: 0;
		font-size: 2rem;
	}
	h2 {
		margin: 0;
		font-family: var(--font-heading);
	}
	section {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.visually-hidden {
		position: absolute;
		width: 1px; /* px-ok: visually hidden, still read aloud */
		height: 1px; /* px-ok: visually hidden, still read aloud */
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.term input {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: inherit;
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
	}
	.pick {
		width: 100%;
		height: 100%;
		min-height: var(--tap-target);
		align-content: center;
		padding: var(--space-1) var(--space-2);
		display: grid;
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
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sub {
		display: none;
		font-size: 0.8rem;
		color: var(--on-surface-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* Narrow tables: folder, tags and source sit under the name. */
	@container data-table (max-width: 40rem) {
		.sub {
			display: block;
		}
	}
	.text {
		display: flex;
		align-items: center;
		min-height: var(--tap-target);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
	}
	.chip {
		padding: 0 var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-full);
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.filters {
		display: grid;
		gap: var(--space-3);
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		display: grid;
		gap: var(--space-1);
	}
	legend {
		padding: 0;
		margin-bottom: var(--space-1);
		font-weight: 600;
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--tap-target);
	}
	.check input {
		width: calc(1.25 * var(--u));
		height: calc(1.25 * var(--u));
	}
	.labels {
		display: grid;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}
	.toggles {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.tag-toggle {
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-full);
		background: var(--surface);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.tag-toggle[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
	}
	.danger :global(.icon-button:not(:disabled)) {
		color: var(--evil);
	}
</style>
