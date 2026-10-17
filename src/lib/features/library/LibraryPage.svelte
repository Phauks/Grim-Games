<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		isSeatable,
		loadScript,
		type GameData,
		type LoadedScript
	} from '#lib/core/data/index.ts';
	import { account } from '#lib/features/account/account.svelte.ts';
	import { profileScripts } from '#lib/features/account/profile-scripts.svelte.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import InfoTokensPanel from '#lib/features/info-tokens/InfoTokensPanel.svelte';
	import PrintScriptButton from '#lib/features/player/PrintScriptButton.svelte';
	import ScriptCopy from '#lib/features/player/ScriptCopy.svelte';
	import {
		forgetScript,
		playScript,
		recentScripts,
		restoreScripts
	} from '#lib/features/scripts/current-script.svelte.ts';
	import {
		describeSource,
		reloadSavedScript,
		sameScript,
		sourcePage
	} from '#lib/features/scripts/saved-scripts.ts';
	import {
		localListings,
		profileProvider,
		recentProvider,
		type ScriptListing
	} from '#lib/features/scripts/script-providers.ts';
	import AddScript from '#lib/features/scripts/AddScript.svelte';
	import ScriptChecks from '#lib/features/scripts/ScriptChecks.svelte';
	import ScriptDetails, { type ScriptFact } from '#lib/features/scripts/ScriptDetails.svelte';
	import { shareTargetFor, type Shareable } from '#lib/features/scripts/share-codes.ts';
	import ShareControl from '#lib/features/scripts/ShareControl.svelte';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import DataTable, { type DataColumn, type DataSort } from '#lib/ui/table/DataTable.svelte';
	import FolderView from './FolderView.svelte';
	import LabelManager from './LabelManager.svelte';
	import NewLabel from './NewLabel.svelte';
	import {
		byName,
		filterLibrary,
		folderPath,
		folderTree,
		libraryKey,
		type FolderFilter
	} from './library-labels.ts';
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

	// ---- View: folders like a file manager, or a table (Trevor, 2026-10-17) ----

	type View = 'folders' | 'table';
	const VIEW_KEY = 'grim-games:library-view';
	function readView(): View {
		try {
			return globalThis.localStorage?.getItem(VIEW_KEY) === 'table' ? 'table' : 'folders';
		} catch {
			return 'folders';
		}
	}
	let view = $state<View>(readView());
	function setView(next: View) {
		view = next;
		try {
			globalThis.localStorage?.setItem(VIEW_KEY, next);
		} catch {
			// A remembered view is only a convenience.
		}
	}
	/** The folder open in the folder view; the top level when none. */
	let currentFolder = $state<string>();

	// ---- Search, filters and sort ----

	let term = $state('');
	let folderFilter = $state<string>('all');
	let tagFilter = $state<string[]>([]);
	type ColumnId = 'name' | 'folder' | 'tags' | 'source';
	let sort = $state<DataSort<ColumnId> | undefined>();

	const folders = $derived(folderTree(libraryLabels.state).map(({ folder }) => folder));
	const tags = $derived(byName(libraryLabels.state.tags));
	/** A folder's whole path, so folders of the same name in different places differ. */
	const folderName = (id: string | undefined) =>
		folderPath(libraryLabels.state, id)
			.map((f) => f.name)
			.join(' / ');
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
		...folders.map((f) => ({ value: f.id, label: folderName(f.id) }))
	]);

	// The folder view searches every folder; the table's filters belong to the table.
	const found = $derived(
		filterLibrary(rows, libraryLabels.state, { term, folder: { kind: 'all' }, tags: [] }).map(
			(row) => ({ key: row.key, name: row.listing.row.name, author: row.listing.row.author })
		)
	);

	// ---- One script's dialog: its folder, tags, details, Share and Remove ----

	let openKey = $state<string>();
	let scriptOpen = $state(false);
	let removing = $state(false);
	/** The Script builder opens a saved script from its id in the hash (never sent to the server). */
	function editInBuilder(scriptId: string) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is resolved; only the hash is added
		void goto(`${resolve('/build-script')}#edit=${encodeURIComponent(scriptId)}`);
	}

	const openRow = $derived(rows.find((row) => row.key === openKey));
	const openLabels = $derived(openKey ? libraryLabels.for(openKey) : { tags: [] });

	/**
	 * A script just added opens straight away, so its folder and tags can be set. Added while a
	 * folder is open, it goes in that folder, as a file saved there would.
	 */
	function openAdded() {
		let newest: Row | undefined;
		for (const row of rows) {
			const used = row.listing.saved?.lastUsedAt ?? -1;
			if (used > (newest?.listing.saved?.lastUsedAt ?? -1)) newest = row;
		}
		if (!newest) return;
		if (view === 'folders' && currentFolder && !libraryLabels.for(newest.key).folder) {
			libraryLabels.setFolder(newest.key, currentFolder);
		}
		openScript(newest);
	}

	function openScript(row: Row) {
		openKey = row.key;
		scriptOpen = true;
	}

	/** No folder, as a Select value (an empty value would read as nothing chosen). */
	const NO_FOLDER = 'none';
	const scriptFolderOptions = $derived([
		{ value: NO_FOLDER, label: t('common.none') },
		...folders.map((f) => ({ value: f.id, label: folderName(f.id) }))
	]);

	/** The open script as players see it, for the player sheet, checks, Print and Play. */
	const openScriptView = $derived.by((): LoadedScript | undefined => {
		const listing = openRow?.listing;
		if (!data || !listing) return undefined;
		if (listing.saved) return reloadSavedScript(listing.saved, data);
		return listing.target.kind === 'json'
			? loadScript(listing.target.json, data).script
			: undefined;
	});

	/** Author, Type and Source, as Search shows them. */
	function factsFor(row: Row): ScriptFact[] {
		const listing = row.listing.row;
		const none = t('common.none');
		return [
			{ label: t('scripts.current.author'), value: listing.author || none },
			{ label: t('scripts.column.type'), value: t(`scripts.kind.${listing.kind}`) },
			{
				label: t('scripts.current.source'),
				value: row.listing.saved ? describeSource(row.listing.saved.source) : sourceOf(row),
				href: sourcePage(row.shareable.source) ?? listing.page
			}
		];
	}

	/** Play: a new game with this script, as Search's Play starts one. */
	function playOpen() {
		const script = openScriptView;
		if (!script || !openRow) return;
		playScript(script, openRow.shareable.source);
		void goto(resolve('/new'));
	}

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
		<div class="page-actions">
			<Button icon="tag" onclick={() => (manageOpen = true)}>{t('library.tags')}</Button>
			<!-- Adding scripts lives here, not on Search (Trevor, 2026-10-17). -->
			<AddScript onsaved={openAdded} />
		</div>
	</div>

	<ErrorBoundary area="library">
		<section aria-labelledby="library-scripts">
			<h2 id="library-scripts">{t('library.scripts')}</h2>
			<div class="find">
				<label class="term">
					<span class="visually-hidden">{t('library.search')}</span>
					<ClearableField bind:value={term}>
						<input
							type="search"
							autocomplete="off"
							enterkeyhint="search"
							placeholder={t('library.searchPlaceholder')}
							bind:value={term}
						/>
					</ClearableField>
				</label>
				<span class="view">
					<Segmented
						label={t('library.view')}
						hideLabel
						value={view}
						options={[
							{ value: 'folders', label: t('library.viewFolders') },
							{ value: 'table', label: t('library.viewTable') }
						]}
						onChange={setView}
					/>
				</span>
			</div>
			{#if view === 'folders'}
				<FolderView
					items={found}
					searching={term.trim() !== ''}
					bind:current={currentFolder}
					onopen={(key) => {
						const row = rows.find((r) => r.key === key);
						if (row) openScript(row);
					}}
				/>
			{:else}
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
			{/if}
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

<!-- The same details as Search (Trevor, 2026-10-17: "exact same info and style"), with the
     Library's own folder and tags as rows of the main info, and Edit and Remove. -->
<Dialog bind:open={scriptOpen} title={openRow?.listing.row.name || t('common.none')} size="full">
	{#if openRow}
		{@const shareable = openRow.shareable}
		{@const built =
			openRow.listing.saved?.source.kind === 'built' ? openRow.listing.saved : undefined}
		<ScriptDetails
			heading={t(`scripts.sourceLabel.${openRow.listing.row.source}`)}
			name={openRow.listing.row.name}
			facts={factsFor(openRow)}
			entries={openRow.listing.row.entries}
			{data}
			sheet={openScriptView ? playerSheet : undefined}
			extra={labelRows}
			version={versionText}
		>
			{#snippet actions()}
				<IconButton
					icon="quickPlay"
					label={t('scripts.details.play')}
					disabled={!openScriptView}
					onclick={playOpen}
				/>
				<PrintScriptButton script={openScriptView} version={openRow.listing.row.version} />
				<ShareControl
					what="script"
					title={openRow.listing.row.name || t('common.none')}
					target={() => shareTargetFor(shareable, location.origin)}
				/>
				{#if built}
					<IconButton
						icon="buildScript"
						label={t('library.edit')}
						onclick={() => editInBuilder(built.scriptId)}
					/>
				{/if}
				<DeleteButton label={t('library.remove')} onclick={() => (removing = true)} />
			{/snippet}
		</ScriptDetails>
	{/if}
</Dialog>

{#snippet versionText()}
	<span data-testid="script-version">{openRow?.listing.row.version || t('common.none')}</span>
{/snippet}

{#snippet playerSheet()}
	{#if openScriptView}
		<!-- Author and version are already in the details above. -->
		<ScriptCopy script={openScriptView} byline={false} />
	{/if}
{/snippet}

{#snippet labelRows()}
	{#if openKey}
		{@const key = openKey}
		{#if data && openScriptView}
			<ScriptChecks script={openScriptView} {data} />
		{/if}
		<dt class="label-term">{t('library.folder')}</dt>
		<dd class="label-value" data-testid="script-labels">
			<Select
				label={t('library.folder')}
				hideLabel
				value={openLabels.folder ?? NO_FOLDER}
				options={scriptFolderOptions}
				onChange={(value) => libraryLabels.setFolder(key, value === NO_FOLDER ? undefined : value)}
			/>
		</dd>
		<dt class="label-term">{t('library.tags')}</dt>
		<dd class="label-value">
			<div class="toggles" role="group" aria-label={t('library.tags')}>
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
		</dd>
	{/if}
{/snippet}

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
	.page-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
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
	.find {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.term {
		flex: 1 1 calc(14 * var(--u));
		min-width: 0;
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
	/* Rows of ScriptDetails' main info, styled as its own rows are. */
	.label-term {
		color: var(--on-surface-muted);
	}
	.label-value {
		margin: 0;
		min-width: 0;
	}
	.view {
		flex: none;
		white-space: nowrap;
	}
	.toggles {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
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
</style>
