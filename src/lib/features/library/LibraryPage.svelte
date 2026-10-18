<script lang="ts">
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { account } from '#lib/features/account/account.svelte.ts';
	import { profileScripts } from '#lib/features/account/profile-scripts.svelte.ts';
	import { savedCharacters } from '#lib/features/character-builder/stores.svelte.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import CampaignScripts from '#lib/features/modes/CampaignScripts.svelte';
	import { fieldsFromEntry, previewCharacter } from '#lib/core/rules/index.ts';
	import type { Character, GameData } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { recentScripts, restoreScripts } from '#lib/features/scripts/current-script.svelte.ts';
	import { describeSource } from '#lib/features/scripts/saved-scripts.ts';
	import {
		localListings,
		profileProvider,
		recentProvider
	} from '#lib/features/scripts/script-providers.ts';
	import AddScript from '#lib/features/scripts/AddScript.svelte';
	import type { Shareable } from '#lib/features/scripts/share-codes.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import DataTable, { type DataColumn, type DataSort } from '#lib/ui/table/DataTable.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import CharacterPane from './CharacterPane.svelte';
	import CollectionPane from './CollectionPane.svelte';
	import FolderBar from './FolderBar.svelte';
	import FolderNameDialog from './FolderNameDialog.svelte';
	import ItemPane from './ItemPane.svelte';
	import LibrarySidebar, { type Place } from './LibrarySidebar.svelte';
	import NameDialog from './NameDialog.svelte';
	import ScriptPane, { type ScriptRow } from './ScriptPane.svelte';
	import { dragToFolder, type DragSource } from './drag-to-folder.ts';
	import { characterCollections } from './library-collections.svelte.ts';
	import {
		characterKey,
		collectionKey,
		folderSize,
		isBrowsing,
		itemsShown,
		type ItemKind,
		type KindFilter,
		type LibraryItem
	} from './library-items.ts';
	import { byName, childFolders, folderPath, libraryKey } from './library-labels.ts';
	import { libraryLabels } from './library-labels.svelte.ts';

	/**
	 * Everything the user has kept, held like files in a file manager (Trevor, 2026-10-18): a
	 * sidebar of folders, kinds and tags; a table of what the open folder holds, each row
	 * draggable onto a folder; and the open item in a pane to the right. Scripts are read from
	 * the Scripts feature's stores and characters from the Character builder's; nothing is
	 * copied. Custom info tokens live on the Info tokens page only (Trevor, 2026-10-17).
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

	/** The sidebar sits beside the list; below this it folds above it. */
	const sided = new MediaQuery('min-width: 40rem', true);
	/** The open item sits beside the list; below this it fills the screen. */
	const roomy = new MediaQuery('min-width: 75rem', true);

	// ---- What the Library holds ----

	const scripts = $derived.by<(ScriptRow & { haystack: string })[]>(() => {
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

	const characters = $derived(
		savedCharacters.list.map((saved) => {
			const fields = fieldsFromEntry(saved.entry);
			return { saved, fields, character: previewCharacter(fields) };
		})
	);

	interface Item extends LibraryItem {
		/** One muted line under the name. */
		sub: string;
		/** Characters: shown as a badge (names always show as badges). */
		character?: Character;
	}

	const items = $derived<Item[]>([
		...scripts.map((s) => ({
			key: s.key,
			kind: 'script' as const,
			name: s.listing.row.name,
			haystack: s.haystack,
			sub: s.listing.row.author
		})),
		...characters.map(({ saved, fields, character }) => ({
			key: characterKey(saved.savedId),
			kind: 'character' as const,
			name: fields.name,
			haystack: `${fields.name} ${fields.ability}`.toLocaleLowerCase(),
			// The character type, as the character's own details name it.
			sub: fields.team[0].toUpperCase() + fields.team.slice(1),
			character
		})),
		...characterCollections.list.map((c) => ({
			key: collectionKey(c.id),
			kind: 'collection' as const,
			name: c.name,
			haystack: c.name.toLocaleLowerCase(),
			sub: t('library.characterCount', { count: c.characters.length })
		}))
	]);

	// ---- Where the list is: folder, kind, tags, search ----

	let place = $state<Place>('files');
	/** The open folder; the top level when none. */
	let currentFolder = $state<string>();
	let kind = $state<KindFilter>('all');
	let tagFilter = $state<string[]>([]);
	let term = $state('');

	const labels = $derived(libraryLabels.state);
	// A tag deleted elsewhere drops out of the filter.
	const activeTags = $derived(tagFilter.filter((id) => labels.tags.some((tag) => tag.id === id)));
	// A folder deleted elsewhere: back to the top level.
	const folder = $derived(
		currentFolder && labels.folders.some((f) => f.id === currentFolder) ? currentFolder : undefined
	);
	const filter = $derived({ folder, kind, tags: activeTags, term });
	const browsing = $derived(isBrowsing(filter));

	/** A folder's whole path, so folders of the same name in different places differ. */
	const folderName = (id: string | undefined) =>
		folderPath(labels, id)
			.map((f) => f.name)
			.join(' / ');
	const tagNames = (ids: readonly string[]) =>
		byName(labels.tags)
			.filter((tag) => ids.includes(tag.id))
			.map((tag) => tag.name);

	// ---- The table ----

	type RowKind = 'folder' | ItemKind;
	interface Row {
		key: string;
		kind: RowKind;
		name: string;
		sub: string;
		/** Folders: the folder's id. */
		folderId?: string;
		character?: Character;
	}
	type ColumnId = 'name' | 'kind' | 'folder' | 'tags';
	let sort = $state<DataSort<ColumnId> | undefined>();

	const KIND_ICONS: Record<RowKind, IconSlot> = {
		folder: 'folder',
		script: 'script',
		character: 'buildCharacter',
		collection: 'players'
	};
	const kindName = (k: RowKind) => t(`library.kindName.${k}`);
	const folderOf = (row: Row) =>
		row.kind === 'folder'
			? folderName(labels.folders.find((f) => f.id === row.folderId)?.parent)
			: folderName(libraryLabels.for(row.key).folder);

	const rows = $derived.by<Row[]>(() => {
		// Folders first, as a file manager lists them; only while browsing one folder.
		const folders: Row[] = browsing
			? childFolders(labels, folder).map((f) => ({
					key: `folder:${f.id}`,
					kind: 'folder',
					name: f.name,
					sub: t('library.itemCount', { count: folderSize(items, labels, f.id) }),
					folderId: f.id
				}))
			: [];
		let shown: Row[] = itemsShown(items, labels, filter).map((item) => ({
			key: item.key,
			kind: item.kind,
			name: item.name,
			sub: item.sub,
			character: item.character
		}));
		if (sort) {
			const { column, direction } = sort;
			const text = (row: Row) => {
				if (column === 'kind') return kindName(row.kind);
				if (column === 'folder') return folderOf(row);
				if (column === 'tags') return tagNames(libraryLabels.for(row.key).tags).join(', ');
				return row.name;
			};
			const sign = direction === 'ascending' ? 1 : -1;
			// Blank values sort last either way.
			shown = [...shown].sort((a, b) => {
				const x = text(a);
				const y = text(b);
				if (!x !== !y) return x ? -1 : 1;
				return sign * x.localeCompare(y, undefined, { sensitivity: 'base', numeric: true });
			});
		}
		return [...folders, ...shown];
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
		{ id: 'kind', label: t('library.column.kind'), sortable: true, wide: true, width: '16%' },
		{ id: 'folder', label: t('library.column.folder'), sortable: true, wide: true, width: '24%' },
		{ id: 'tags', label: t('library.column.tags'), sortable: true, wide: true, width: '24%' }
	]);

	// ---- Moving: drag a row onto a folder ----

	function move(source: DragSource, target: string | undefined) {
		if (source.folder) libraryLabels.moveFolder(source.id, target);
		else libraryLabels.setFolder(source.id, target);
	}

	// ---- The open item ----

	let openKey = $state<string>();
	const openScript = $derived(scripts.find((s) => s.key === openKey));
	const openCharacter = $derived(
		characters.find(({ saved }) => characterKey(saved.savedId) === openKey)?.saved
	);
	const openCollection = $derived(
		characterCollections.list.find((c) => collectionKey(c.id) === openKey)
	);
	// Closing the pane, or the item going (deleted here or elsewhere), clears it.
	const paneOpen = {
		get open() {
			return !!(openScript || openCharacter || openCollection);
		},
		set open(value: boolean) {
			if (!value) openKey = undefined;
		}
	};

	function activate(row: Row) {
		if (row.kind === 'folder') {
			currentFolder = row.folderId;
			term = '';
		} else {
			openKey = row.key;
		}
	}

	/**
	 * A script just added opens straight away, so its folder and tags can be set. Added while a
	 * folder is open, it goes in that folder, as a file saved there would.
	 */
	function openAdded() {
		let newest: (typeof scripts)[number] | undefined;
		for (const row of scripts) {
			const used = row.listing.saved?.lastUsedAt ?? -1;
			if (used > (newest?.listing.saved?.lastUsedAt ?? -1)) newest = row;
		}
		if (!newest) return;
		if (folder && !libraryLabels.for(newest.key).folder) {
			libraryLabels.setFolder(newest.key, folder);
		}
		openKey = newest.key;
	}

	// ---- New folder, new collection ----

	let folderNaming = $state(false);
	let collectionNaming = $state(false);
	function addCollection(name: string) {
		const id = characterCollections.add(name);
		if (!id) return;
		if (folder) libraryLabels.setFolder(collectionKey(id), folder);
		openKey = collectionKey(id);
	}
</script>

<Page title={t('library.heading')}>
	{#snippet actions()}
		<!-- Icon buttons, so the title row stays one row on a phone (Trevor: icon buttons). -->
		<IconButton
			icon="folder"
			label={t('library.newFolder')}
			onclick={() => (folderNaming = true)}
		/>
		<IconButton
			icon="players"
			label={t('library.newCollection')}
			onclick={() => (collectionNaming = true)}
		/>
		<IconButton
			icon="buildCharacter"
			label={t('library.newCharacter')}
			onclick={() => void goto(resolve('/build-character'))}
		/>
		<!-- Adding scripts lives here, not on Search (Trevor, 2026-10-17). -->
		<AddScript onsaved={openAdded} />
	{/snippet}

	<ErrorBoundary area="library">
		<div class="manager" class:sided={sided.current} class:roomy={roomy.current}>
			{#if sided.current}
				<div class="side">
					<LibrarySidebar bind:current={currentFolder} bind:kind bind:place bind:tags={tagFilter} />
				</div>
			{:else}
				<PageSection title={t('library.navigation')} collapsible storageKey="library-navigation">
					<LibrarySidebar bind:current={currentFolder} bind:kind bind:place bind:tags={tagFilter} />
				</PageSection>
			{/if}

			<div class="files">
				{#if place === 'campaigns'}
					<PageSection title={t('library.campaigns')}>
						<CampaignScripts {data} />
					</PageSection>
				{:else}
					<SearchField
						bind:value={term}
						label={t('library.search')}
						placeholder={t('library.searchPlaceholder')}
					/>
					<FolderBar bind:current={currentFolder} searching={!browsing} />
					<div data-testid="library-table">
						<DataTable
							label={t('library.table')}
							{columns}
							{rows}
							key={(row) => row.key}
							{cell}
							{sort}
							{onSort}
							rowSelected={(row) => row.key === openKey}
							narrow="hide"
							empty={t('common.none')}
						/>
					</div>
				{/if}
			</div>

			{#if roomy.current}
				<div class="pane">
					{@render pane(true)}
				</div>
			{/if}
		</div>
	</ErrorBoundary>
</Page>

{#if !roomy.current}
	{@render pane(false)}
{/if}

{#snippet pane(inline: boolean)}
	{#if openScript}
		<ScriptPane bind:open={paneOpen.open} row={openScript} {data} {inline} />
	{:else if openCharacter}
		<CharacterPane bind:open={paneOpen.open} saved={openCharacter} {inline} />
	{:else if openCollection}
		<CollectionPane bind:open={paneOpen.open} collection={openCollection} {data} {inline} />
	{:else if inline}
		<ItemPane title={t('library.pane')} inline>{t('common.none')}</ItemPane>
	{/if}
{/snippet}

{#snippet cell(row: Row, column: DataColumn<ColumnId>)}
	{#if column.id === 'name'}
		{@const where = folderOf(row)}
		<button
			type="button"
			class="pick"
			data-drop-folder={row.folderId}
			data-kind={row.kind}
			onclick={() => activate(row)}
			use:dragToFolder={{
				source: {
					id: row.folderId ?? row.key,
					folder: row.kind === 'folder',
					label: row.name || t('common.none')
				},
				onmove: move
			}}
		>
			<span class="icon" class:accent={row.kind === 'folder'}
				><Icon name={KIND_ICONS[row.kind]} /></span
			>
			<span class="text-block">
				<span class="title">
					{#if row.character}
						<CharacterBadge
							characterId={row.character.id}
							character={row.character}
							inline
							interactive={false}
						/>
					{:else}
						{row.name || t('common.none')}
					{/if}
				</span>
				<span class="sub"
					>{[row.sub, browsing ? '' : where].filter(Boolean).join(' · ') || ' '}</span
				>
			</span>
		</button>
	{:else if column.id === 'kind'}
		<span class="text">{kindName(row.kind)}</span>
	{:else if column.id === 'folder'}
		<span class="text">{folderOf(row) || t('library.heading')}</span>
	{:else}
		{@const names = tagNames(libraryLabels.for(row.key).tags)}
		<span class="chips">
			{#each names as name (name)}<span class="chip">{name}</span>{:else}<span class="muted"
					>{t('common.none')}</span
				>{/each}
		</span>
	{/if}
{/snippet}

<FolderNameDialog
	bind:open={folderNaming}
	parent={folder}
	oncreated={(id) => {
		currentFolder = id;
		place = 'files';
	}}
/>

<NameDialog
	bind:open={collectionNaming}
	title={t('library.newCollection')}
	onsave={addCollection}
/>

<style>
	.manager {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
		align-items: start;
	}
	.manager.sided {
		grid-template-columns: calc(16 * var(--u)) minmax(0, 1fr);
	}
	.manager.sided.roomy {
		grid-template-columns: calc(16 * var(--u)) minmax(0, 1fr) minmax(0, 1fr);
	}
	/* The sidebar and pane stay in view beside the list, just below the app header. */
	.side,
	.pane {
		position: sticky;
		top: calc(var(--tap-target) + env(safe-area-inset-top) + var(--space-2));
		max-height: calc(100dvh - var(--tap-target) - env(safe-area-inset-top) - var(--space-4));
		min-width: 0;
	}
	.side {
		overflow-y: auto;
	}
	.pane {
		display: grid;
		height: calc(100dvh - var(--tap-target) - env(safe-area-inset-top) - var(--space-4));
	}
	.files {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.pick {
		width: 100%;
		height: 100%;
		min-height: var(--tap-target);
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
		/* A held touch drags the row rather than selecting its text. */
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.pick:hover {
		background: var(--surface-selected);
	}
	.icon {
		display: flex;
		font-size: 1.3rem;
		color: var(--on-surface-muted);
	}
	.icon.accent {
		color: var(--accent);
	}
	.text-block {
		display: grid;
		min-width: 0;
	}
	.title {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sub {
		min-height: 1.2em;
		font-size: 0.8rem;
		color: var(--on-surface-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
	/* A tag looks the same everywhere, in the font its name was typed in (Trevor, 2026-10-18). */
	.chip {
		padding: 0 var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-full);
		font-family: var(--font-control);
		font-size: 0.85rem;
		white-space: nowrap;
	}
	.muted {
		color: var(--on-surface-muted);
	}
	/* Dragging: the row's name follows the finger, and the folder under it is outlined. */
	:global(.library-drag-ghost) {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 1000;
		max-width: calc(20 * var(--u));
		margin: calc(-1 * var(--space-5)) 0 0 var(--space-2);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-full);
		background: var(--accent);
		color: var(--on-accent);
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		pointer-events: none;
	}
	:global([data-drop-over]) {
		outline: 2px dashed var(--accent);
		outline-offset: -2px;
		background: var(--surface-selected);
	}
	:global(body.library-dragging) {
		cursor: grabbing;
		user-select: none;
		-webkit-user-select: none;
	}
</style>
