<script lang="ts" module>
	import type { SavedCharacter } from '#lib/features/character-builder/saved-characters.ts';
	import type { CharacterCollection } from './library-collections.ts';
	import type { ScriptRow as PickedScript } from './ScriptPane.svelte';

	/** An item tapped in a picking browser, looked up for the caller. */
	export type LibraryPick =
		| { kind: 'script'; script: PickedScript }
		| { kind: 'character'; saved: SavedCharacter }
		| { kind: 'collection'; collection: CharacterCollection };
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
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
	import type { Shareable } from '#lib/features/scripts/share-codes.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';
	import { readStored, writeStored } from '#lib/ui/stored.ts';
	import DataTable, { type DataColumn, type DataSort } from '#lib/ui/table/DataTable.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import CharacterPane from './CharacterPane.svelte';
	import CollectionPane from './CollectionPane.svelte';
	import FolderBar from './FolderBar.svelte';
	import FolderNameDialog from './FolderNameDialog.svelte';
	import ItemPane, { setLibraryPick, setLibraryWindow } from './ItemPane.svelte';
	import LibrarySidebar, { type Place } from './LibrarySidebar.svelte';
	import NameDialog from './NameDialog.svelte';
	import { timestampName } from '#lib/core/timestamp-name.ts';
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
	import {
		byName,
		childFolders,
		folderMoveProblem,
		folderPath,
		libraryKey
	} from './library-labels.ts';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { libraryLabels } from './library-labels.svelte.ts';

	/**
	 * Everything the user has kept, held like files in a file manager (Trevor, 2026-10-18): a
	 * sidebar of folders, kinds and tags; a table of what the open folder holds, each row
	 * draggable onto a folder; and the open item in a pane to the right. Scripts are read from
	 * the Scripts feature's stores and characters from the Character builder's; nothing is
	 * copied. Custom info tokens live on the Info tokens page only (Trevor, 2026-10-17).
	 *
	 * The Library page, and a picker elsewhere (Trevor, 2026-10-18: the Script builder's
	 * "Open a saved script" opens the file manager in a modal): `kind` keeps it to one kind of
	 * item, without the Kinds list, Campaigns or a Kind column, and `onpick` gets the tapped
	 * item instead of the pane. With Preview on, a tap shows the item beside the list and the
	 * pane's `pickLabel` button (or a double-click) hands it over.
	 */
	interface Props {
		/** Only this kind of item. */
		kind?: ItemKind;
		/** Tapping an item (with Preview off) hands it here instead of opening it in the pane. */
		onpick?: (pick: LibraryPick) => void;
		/** The previewed item's button that hands it to `onpick`. */
		pickLabel?: string;
	}

	let { kind: onlyKind, onpick, pickLabel }: Props = $props();

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

	/**
	 * Preview (Trevor, 2026-10-18): on, the open item shows beside the list; off, the list takes
	 * the room and an item opens in a window over the page. Remembered on this device. Where
	 * nothing fits beside the list, items always open in a window, so the Library's button
	 * rests; a picker previews too.
	 */
	const PREVIEW_KEY = 'grim-games:library-preview';
	let preview = $state(readStored<boolean>(PREVIEW_KEY) !== false);
	const previewing = $derived(roomy.current && preview);
	/** Whether the item shows beside the list now (the Preview button's pressed state). */
	export function isPreviewing() {
		return previewing;
	}
	/** Whether there is room for Preview at all. */
	export function canPreview() {
		return roomy.current;
	}
	export function togglePreview() {
		preview = !preview;
		writeStored(PREVIEW_KEY, preview);
		// The previewed item goes with the preview rather than jumping into a window.
		if (!preview) openKey = undefined;
	}

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
			if (!shareable) return [];
			const key = libraryKey(identity);
			// Renamed in the Library: shown by that name, found by both (Trevor, 2026-10-18).
			const renamed = libraryLabels.for(key).name;
			const shown = renamed ? { ...listing, row: { ...listing.row, name: renamed } } : listing;
			const haystack = renamed
				? `${listing.row.haystack} ${renamed.toLocaleLowerCase()}`
				: listing.row.haystack;
			return [{ key, haystack, listing: shown, ownName: listing.row.name, shareable }];
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

	const allItems = $derived<Item[]>([
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

	const items = $derived(onlyKind ? allItems.filter((item) => item.kind === onlyKind) : allItems);

	// ---- Where the list is: folder, kind, tags, search ----

	let place = $state<Place>('files');
	/** The open folder; the top level when none. */
	let currentFolder = $state<string>();
	let chosenKind = $state<KindFilter>('all');
	const kind = $derived<KindFilter>(onlyKind ?? chosenKind);
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

	// Every column filters (Trevor, 2026-10-18), with the shared table's built-in filters.
	const allColumns = $derived<DataColumn<ColumnId, Row>[]>([
		{
			id: 'name',
			label: t('library.column.name'),
			sortable: true,
			flush: true,
			value: (row) => row.name
		},
		{
			id: 'kind',
			label: t('library.column.kind'),
			sortable: true,
			wide: true,
			width: '16%',
			value: (row) => kindName(row.kind)
		},
		{
			id: 'folder',
			label: t('library.column.folder'),
			sortable: true,
			wide: true,
			width: '24%',
			value: folderOf
		},
		{
			id: 'tags',
			label: t('library.column.tags'),
			sortable: true,
			wide: true,
			width: '24%',
			value: (row) => tagNames(libraryLabels.for(row.key).tags)
		}
	]);
	// One kind only: no Kind column, as every row would say the same.
	const columns = $derived(allColumns.filter((c) => !(onlyKind && c.id === 'kind')));

	// ---- Moving: drag a row onto a folder ----

	/** A drop onto a folder, from the table or the sidebar; a folder that can't go there stays. */
	function move(source: DragSource, target: string | undefined) {
		if (!source.folder) {
			libraryLabels.setFolder(source.id, target);
			return;
		}
		const problem = folderMoveProblem(labels, source.id, target);
		if (problem === 'inside') toast(t('library.moveInside', { name: source.label }));
		else if (problem === 'nameTaken') toast(t('library.moveNameTaken', { name: source.label }));
		else libraryLabels.moveFolder(source.id, target);
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

	/**
	 * The item in a window over the page (Trevor, 2026-10-18: "you should be able to click into
	 * a file to see its contents in a modal"), whether or not Preview is on. Closing the window
	 * keeps the item open in the preview.
	 */
	let windowOpen = $state(false);
	function openWindow(key: string) {
		openKey = key;
		windowOpen = true;
	}
	setLibraryWindow(() => (windowOpen = true));
	// A picker has no window: its previewed item is handed over instead.
	setLibraryPick({
		active: () => !!onpick,
		label: () => pickLabel ?? t('library.pick'),
		pick: () => pick(openKey)
	});
	const isOpen = (inline: boolean) => paneOpen.open && (inline || !previewing || windowOpen);
	function setOpen(inline: boolean, value: boolean) {
		if (!inline && previewing) windowOpen = value;
		else paneOpen.open = value;
	}
	$effect(() => {
		if (!paneOpen.open) windowOpen = false;
	});

	/**
	 * Like Finder (Trevor, 2026-10-18: "require double clicking to enter a folder or file"): one
	 * click or tap selects a row, and with Preview on a selected item shows beside the list; a
	 * double click or double tap (or Enter) opens it: a folder is entered, an item opens in a
	 * window, and a picker takes it. Timed here rather than with `dblclick`, so a double tap on a
	 * touchscreen opens the same way.
	 */
	const DOUBLE_MS = 450;
	let selectedKey = $state<string>();
	let lastTap: { key: string; at: number } | undefined;
	/** A selected folder row in the list as it stands (not one left behind in another folder). */
	const selectedFolder = $derived(rows.find((r) => r.key === selectedKey)?.folderId);

	function tapRow(row: Row, event: MouseEvent) {
		const now = event.timeStamp;
		const double = lastTap?.key === row.key && now - lastTap.at < DOUBLE_MS;
		lastTap = double ? undefined : { key: row.key, at: now };
		if (double) activate(row);
		else select(row);
	}

	function select(row: Row) {
		selectedKey = row.key;
		if (row.kind !== 'folder' && previewing) openKey = row.key;
	}

	function rowKey(row: Row, event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			activate(row);
		} else if (event.key === 'F2' && row.folderId) {
			event.preventDefault();
			renameFolder(row.folderId);
		}
	}

	// ---- Renaming a folder from where it is listed (Trevor, 2026-10-18: "from outside the folder") ----

	let renaming = $state<string>();
	let renameOpen = $state(false);
	function renameFolder(id: string) {
		renaming = id;
		renameOpen = true;
	}

	function activate(row: Row) {
		selectedKey = row.key;
		if (row.kind === 'folder') {
			currentFolder = row.folderId;
			term = '';
		} else if (onpick) {
			pick(row.key);
		} else {
			openWindow(row.key);
		}
	}

	/** Hands the item to the picker's `onpick`. */
	function pick(key: string | undefined) {
		if (!onpick || !key) return;
		const script = scripts.find((s) => s.key === key);
		const saved = characters.find(({ saved }) => characterKey(saved.savedId) === key)?.saved;
		const collection = characterCollections.list.find((c) => collectionKey(c.id) === key);
		if (script) onpick({ kind: 'script', script });
		else if (saved) onpick({ kind: 'character', saved });
		else if (collection) onpick({ kind: 'collection', collection });
	}

	/** An item that changed kind opens as its new self. */
	function openItem(key: string) {
		openKey = key;
		selectedKey = key;
	}

	/**
	 * A script just added opens straight away, so its folder and tags can be set. Added while a
	 * folder is open, it goes in that folder, as a file saved there would.
	 */
	export function openAdded(key?: string) {
		if (key) return openNew(key);
		let newest: (typeof scripts)[number] | undefined;
		for (const row of scripts) {
			const used = row.listing.saved?.lastUsedAt ?? -1;
			if (used > (newest?.listing.saved?.lastUsedAt ?? -1)) newest = row;
		}
		if (newest) openNew(newest.key);
	}

	function openNew(key: string) {
		if (folder && !libraryLabels.for(key).folder) libraryLabels.setFolder(key, folder);
		openKey = key;
		selectedKey = key;
	}

	// ---- New folder, new collection ----

	let folderNaming = $state(false);
	let collectionNaming = $state(false);
	export function newCollection() {
		collectionNaming = true;
	}
	function addCollection(name: string) {
		const id = characterCollections.add(name);
		if (!id) return;
		if (folder) libraryLabels.setFolder(collectionKey(id), folder);
		openKey = collectionKey(id);
		selectedKey = collectionKey(id);
	}
</script>

<ErrorBoundary area="library">
	<div
		class="manager"
		class:sided={sided.current}
		class:roomy={previewing}
		class:picking={!!onpick}
	>
		{#if sided.current}
			<div class="side">
				<LibrarySidebar
					bind:current={currentFolder}
					bind:kind={chosenKind}
					kinds={!onlyKind}
					bind:place
					bind:tags={tagFilter}
					count={(f) => folderSize(items, labels, f)}
					onnewfolder={() => (folderNaming = true)}
					onmove={move}
					onrename={renameFolder}
				/>
			</div>
		{:else}
			<PageSection title={t('library.navigation')} collapsible storageKey="library-navigation">
				<LibrarySidebar
					bind:current={currentFolder}
					bind:kind={chosenKind}
					kinds={!onlyKind}
					bind:place
					bind:tags={tagFilter}
					count={(f) => folderSize(items, labels, f)}
					onnewfolder={() => (folderNaming = true)}
					onmove={move}
					onrename={renameFolder}
				/>
			</PageSection>
		{/if}

		<!-- One toolbar over the list (Trevor, 2026-10-18: the parts should feel connected). -->
		<div class="toolbar">
			<FolderBar
				bind:current={currentFolder}
				bind:term
				searching={!browsing || place === 'campaigns'}
				selected={selectedFolder}
			/>
		</div>

		<div class="files">
			{#if place === 'campaigns'}
				<CampaignScripts {data} {term} frameless={sided.current} />
			{:else}
				<div data-testid="library-table">
					<DataTable
						label={t('library.table')}
						{columns}
						{rows}
						key={(row) => row.key}
						{cell}
						{sort}
						{onSort}
						rowSelected={(row) => row.key === selectedKey}
						narrow="hide"
						pageSize={100}
						hideKey="library"
						empty={t('common.none')}
						frameless={sided.current}
					/>
				</div>
			{/if}
		</div>

		{#if previewing}
			<div class="pane">
				{@render pane(true)}
			</div>
		{/if}
	</div>
</ErrorBoundary>

<!-- The open item in a window: always without Preview, and from the preview when opened. -->
{#if !onpick && (!previewing || windowOpen)}
	{@render pane(false)}
{/if}

{#snippet pane(inline: boolean)}
	{#if openScript}
		<ScriptPane
			bind:open={() => isOpen(inline), (v) => setOpen(inline, v)}
			row={openScript}
			{data}
			{inline}
			onchanged={openItem}
		/>
	{:else if openCharacter}
		<CharacterPane
			bind:open={() => isOpen(inline), (v) => setOpen(inline, v)}
			saved={openCharacter}
			{data}
			{inline}
			onchanged={openItem}
		/>
	{:else if openCollection}
		<CollectionPane
			bind:open={() => isOpen(inline), (v) => setOpen(inline, v)}
			collection={openCollection}
			{data}
			{inline}
			onchanged={openItem}
		/>
	{:else if inline}
		<ItemPane title={t('library.pane')} inline>{t('common.none')}</ItemPane>
	{/if}
{/snippet}

{#snippet cell(row: Row, column: DataColumn<ColumnId, Row>)}
	{#if column.id === 'name'}
		{@const where = folderOf(row)}
		<button
			type="button"
			class="pick"
			data-drop-folder={row.folderId}
			data-kind={row.kind}
			onclick={(e) => tapRow(row, e)}
			onkeydown={(e) => rowKey(row, e)}
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

<!-- The new folder isn't opened (Trevor, 2026-10-18); it is listed in the folder made in. -->
<FolderNameDialog bind:open={folderNaming} parent={folder} />
<FolderNameDialog bind:open={renameOpen} folder={renaming} />

<NameDialog
	bind:open={collectionNaming}
	title={t('library.newCollection')}
	blankName={timestampName}
	onsave={addCollection}
/>

<style>
	.manager {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
		align-items: start;
	}
	.toolbar {
		display: grid;
		gap: var(--space-2);
		min-width: 0;
	}
	/*
	 * Wider: one window, like a file manager (Trevor, 2026-10-18: the sidebar, list and pane
	 * felt like separate parts). One frame, columns split by lines, one toolbar across the list
	 * and pane, and the open item marked in the accent in the list and on the pane.
	 */
	.manager.sided {
		grid-template-columns: calc(16 * var(--u)) minmax(0, 1fr);
		grid-template-rows: auto 1fr;
		gap: 0;
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
		overflow: clip;
	}
	.manager.sided.roomy {
		grid-template-columns: calc(16 * var(--u)) minmax(0, 1fr) minmax(0, 1fr);
	}
	.sided .side {
		grid-row: 1 / -1;
		padding: var(--space-3);
	}
	/* The sidebar's dividing line runs the window's full height on the list's side. */
	.sided .toolbar {
		grid-column: 2 / -1;
		padding: var(--space-2) var(--space-3);
		border-bottom: var(--card-border);
		border-inline-start: var(--card-border);
	}
	/* The table runs to the column's walls (Trevor, 2026-10-18: not a separate instance). */
	.sided .files {
		align-self: stretch;
		border-inline-start: var(--card-border);
	}
	.sided .pane {
		border-inline-start: var(--card-border);
	}
	:global(.sided tr.selected) .pick {
		box-shadow: inset 0.25rem 0 0 var(--accent);
	}
	/* The sidebar and pane stay in view beside the list, just below the app header (not in a
	   picker's dialog, which scrolls itself). */
	.manager:not(.picking) .side,
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
