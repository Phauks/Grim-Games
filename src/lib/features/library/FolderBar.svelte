<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { tick } from 'svelte';
	import FolderNameDialog from './FolderNameDialog.svelte';
	import { TOP_FOLDER } from './drag-to-folder.ts';
	import {
		folderAndDescendants,
		folderPath,
		folderTree,
		nameFree,
		siblings
	} from './library-labels.ts';
	import { libraryLabels } from './library-labels.svelte.ts';

	/**
	 * Where the list is in the folders, like a file manager's path bar: a breadcrumb back up
	 * (each step also a place to drop a dragged item), and the open folder's own controls.
	 */
	interface Props {
		/** The open folder; the top level when none. */
		current?: string;
		/** A search or filter shows items from every folder: the folder controls rest. */
		searching: boolean;
		/** The Library's search, behind a button beside the folder controls (Trevor, 2026-10-18). */
		term?: string;
		/**
		 * A folder row selected in the list: the folder controls act on it, so a folder is
		 * renamed, moved or deleted from outside it (Trevor, 2026-10-18).
		 */
		selected?: string;
	}

	let { current = $bindable(), searching, term = $bindable(''), selected }: Props = $props();

	/*
	 * The search opens over the path, in the same row, so nothing moves (no reflow) and the
	 * list keeps the height a second toolbar row took. It folds away again when emptied and
	 * left, or with Esc (the field's own first Esc clears it); a search left typed keeps it open
	 * and the button pressed.
	 */
	let searchOpen = $state(!!term);
	let searchBox = $state<HTMLElement>();
	async function openSearch() {
		searchOpen = true;
		await tick();
		searchBox?.querySelector('input')?.focus();
	}
	function closeSearch() {
		term = '';
		searchOpen = false;
	}
	function onSearchFocusOut(event: FocusEvent) {
		if (searchBox?.contains(event.relatedTarget as Node | null)) return;
		if (!term) searchOpen = false;
	}

	const labels = $derived(libraryLabels.state);
	const path = $derived(folderPath(labels, current));
	// A folder deleted elsewhere: back to the top level.
	const inside = $derived(path.at(-1));
	/** What the controls act on: the selected folder row, else the open folder. */
	const here = $derived(labels.folders.find((f) => f.id === selected) ?? inside);
	const pathName = (id: string | undefined) =>
		folderPath(labels, id)
			.map((f) => f.name)
			.join(' / ');

	let naming = $state<{ folder?: string }>();
	let nameOpen = $state(false);
	let moveOpen = $state(false);
	/** The top level, as a Select value (an empty value would read as nothing chosen). */
	const TOP = 'top';
	let moveTo = $state(TOP);
	const target = $derived(moveTo === TOP ? undefined : moveTo);
	let deleteOpen = $state(false);

	function rename() {
		if (!here) return;
		naming = { folder: here.id };
		nameOpen = true;
	}

	const moveOptions = $derived.by(() => {
		if (!here) return [];
		const inside = folderAndDescendants(labels, here.id);
		return [
			{ value: TOP, label: t('library.heading') },
			...folderTree(labels)
				.filter(({ folder }) => !inside.has(folder.id))
				.map(({ folder }) => ({ value: folder.id, label: pathName(folder.id) }))
		];
	});
	const moveOk = $derived(
		!!here &&
			target !== here.parent &&
			nameFree(siblings(labels, 'folders', target), here.name, here.id)
	);
	function startMove() {
		moveTo = here?.parent ?? TOP;
		moveOpen = true;
	}
	function move() {
		if (!here || !moveOk) return;
		libraryLabels.moveFolder(here.id, target);
		moveOpen = false;
	}

	function remove() {
		if (!here) return;
		const up = here.parent;
		const wasOpen = here.id === inside?.id;
		libraryLabels.delete('folders', here.id);
		if (wasOpen) current = up;
	}
</script>

<div class="bar">
	<nav aria-label={t('library.folderPath')} class="crumbs" inert={searchOpen}>
		<ol>
			<li>
				{#if inside}
					<button
						type="button"
						class="crumb root"
						data-drop-folder={TOP_FOLDER}
						title={t('library.heading')}
						onclick={() => (current = undefined)}>{@render root()}</button
					>
				{:else}
					<span class="crumb root" aria-current="location" title={t('library.heading')}
						>{@render root()}</span
					>
				{/if}
			</li>
			{#each path as folder (folder.id)}
				<li>
					<span class="sep" aria-hidden="true">/</span>
					{#if folder.id === inside?.id}
						<span class="crumb" aria-current="location">{folder.name}</span>
					{:else}
						<button
							type="button"
							class="crumb"
							data-drop-folder={folder.id}
							onclick={() => (current = folder.id)}>{folder.name}</button
						>
					{/if}
				</li>
			{/each}
		</ol>
	</nav>
	<!-- Always there, out of sight when folded, so the row is the same height either way. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="search"
		inert={!searchOpen}
		bind:this={searchBox}
		onfocusout={onSearchFocusOut}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeSearch();
		}}
	>
		<SearchField
			bind:value={term}
			label={t('library.search')}
			placeholder={t('library.searchPlaceholder')}
		/>
	</div>
	<div class="actions">
		<IconButton
			icon="search"
			label={t('library.search')}
			aria-expanded={searchOpen}
			aria-pressed={!!term}
			onclick={() => (searchOpen ? closeSearch() : void openSearch())}
		/>
		<!-- Always rendered, so nothing moves when a folder opens; usable inside a folder only. -->
		<IconButton
			icon="rename"
			label={here ? t('library.renameNamed', { name: here.name }) : t('library.renameTitle')}
			disabled={!here || searching}
			onclick={rename}
		/>
		<IconButton
			icon="move"
			label={here ? t('library.moveNamed', { name: here.name }) : t('library.move')}
			disabled={!here || searching}
			onclick={startMove}
		/>
		<DeleteButton
			label={here ? t('library.deleteNamed', { name: here.name }) : t('library.deleteFolder')}
			disabled={!here || searching}
			onclick={() => (deleteOpen = true)}
		/>
	</div>
</div>

<!-- The top level is a home icon, which saves room (Trevor, 2026-10-18); it still reads "Library". -->
{#snippet root()}
	<Icon name="home" /><span class="visually-hidden">{t('library.heading')}</span>
{/snippet}

<FolderNameDialog bind:open={nameOpen} folder={naming?.folder} parent={here?.id} />

<Dialog bind:open={moveOpen} title={here ? t('library.moveNamed', { name: here.name }) : ''}>
	<Select
		label={t('library.moveTo')}
		value={moveTo}
		options={moveOptions}
		onChange={(value) => (moveTo = value)}
	/>
	<p class="error" role="status">
		{here && target !== here.parent && !moveOk ? t('library.nameTaken') : ''}
	</p>
	{#snippet actions()}
		<ModalActions onCancel={() => (moveOpen = false)} onConfirm={move} disabled={!moveOk} />
	{/snippet}
</Dialog>

<ConfirmDialog
	bind:open={deleteOpen}
	title={t('library.deleteFolderConfirm')}
	danger
	onConfirm={remove}
>
	{#if here}
		<p>
			{t('library.deleteFolderBody', {
				name: here.name,
				parent: here.parent ? pathName(here.parent) : t('library.heading')
			})}
		</p>
	{/if}
</ConfirmDialog>

<style>
	/* The path and, when open, the search share the first cell; the buttons sit after them. */
	.bar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
	}
	.crumbs,
	.search {
		grid-area: 1 / 1;
		min-width: 0;
	}
	.crumbs[inert],
	.search[inert] {
		visibility: hidden;
	}
	ol {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
	}
	li {
		display: flex;
		align-items: center;
		min-width: 0;
	}
	.sep {
		padding-inline: var(--space-1);
		color: var(--on-surface-muted);
	}
	.crumb {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap-target);
		padding: 0 var(--space-1);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.root {
		justify-content: center;
		min-width: var(--tap-target);
	}
	button.crumb {
		color: var(--accent);
		cursor: pointer;
		text-decoration: underline;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	.error {
		margin: var(--space-1) 0 0;
		min-height: 1.2em;
		font-size: 0.85rem;
		color: var(--evil);
	}
</style>
