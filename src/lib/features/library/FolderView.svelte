<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import FolderNameDialog from './FolderNameDialog.svelte';
	import {
		childFolders,
		folderAndDescendants,
		folderPath,
		folderTree,
		labelUses,
		nameFree,
		siblings
	} from './library-labels.ts';
	import { libraryLabels } from './library-labels.svelte.ts';

	/**
	 * Scripts held like files (Trevor, 2026-10-17: "like files in a file manager"): folders open,
	 * hold scripts and other folders, and a breadcrumb leads back up. While searching, matches
	 * from every folder are listed together, each with the folder it is in.
	 */
	interface Item {
		key: string;
		name: string;
		author: string;
	}

	interface Props {
		/** The scripts to show: all of them, or the search's matches. */
		items: readonly Item[];
		searching: boolean;
		/** The open folder; the top level when none. */
		current?: string;
		onopen: (key: string) => void;
	}

	let { items, searching, current = $bindable(), onopen }: Props = $props();

	const labels = $derived(libraryLabels.state);
	const path = $derived(folderPath(labels, current));
	// A folder deleted elsewhere: back to the top level.
	const here = $derived(path.at(-1));
	const folders = $derived(searching ? [] : childFolders(labels, here?.id));
	const scripts = $derived(
		searching ? items : items.filter((item) => libraryLabels.for(item.key).folder === here?.id)
	);
	const pathName = (id: string | undefined) =>
		folderPath(labels, id)
			.map((f) => f.name)
			.join(' / ');
	const itemCount = (id: string) =>
		childFolders(labels, id).length + labelUses(labels, 'folders', id);

	let naming = $state<{ folder?: string }>();
	let nameOpen = $state(false);
	let moveOpen = $state(false);
	/** The top level, as a Select value (an empty value would read as nothing chosen). */
	const TOP = 'top';
	let moveTo = $state(TOP);
	const target = $derived(moveTo === TOP ? undefined : moveTo);
	let deleteOpen = $state(false);

	function newFolder() {
		naming = {};
		nameOpen = true;
	}
	function rename() {
		if (!here) return;
		naming = { folder: here.id };
		nameOpen = true;
	}

	const moveOptions = $derived.by(() => {
		if (!here) return [];
		const inside = folderAndDescendants(labels, here.id);
		return [
			{ value: TOP, label: t('library.scripts') },
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
		libraryLabels.delete('folders', here.id);
		current = up;
	}
</script>

<div class="bar">
	<nav aria-label={t('library.folderPath')} class="crumbs">
		<ol>
			<li>
				{#if here}
					<button type="button" class="crumb" onclick={() => (current = undefined)}
						>{t('library.scripts')}</button
					>
				{:else}
					<span class="crumb" aria-current="location">{t('library.scripts')}</span>
				{/if}
			</li>
			{#each path as folder (folder.id)}
				<li>
					<span class="sep" aria-hidden="true">/</span>
					{#if folder.id === here?.id}
						<span class="crumb" aria-current="location">{folder.name}</span>
					{:else}
						<button type="button" class="crumb" onclick={() => (current = folder.id)}
							>{folder.name}</button
						>
					{/if}
				</li>
			{/each}
		</ol>
	</nav>
	<div class="actions">
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
		<Button icon="folder" disabled={searching} onclick={newFolder}>{t('library.newFolder')}</Button>
	</div>
</div>

<ul class="tiles" data-testid="library-folders" aria-label={here?.name ?? t('library.scripts')}>
	{#each folders as folder (folder.id)}
		<li>
			<button type="button" class="tile" onclick={() => (current = folder.id)}>
				<span class="icon folder"><Icon name="folder" /></span>
				<span class="text">
					<span class="title">{folder.name}</span>
					<span class="sub">{t('library.itemCount', { count: itemCount(folder.id) })}</span>
				</span>
			</button>
		</li>
	{/each}
	{#each scripts as item (item.key)}
		{@const where = searching ? pathName(libraryLabels.for(item.key).folder) : ''}
		<li>
			<button type="button" class="tile" onclick={() => onopen(item.key)}>
				<span class="icon"><Icon name="script" /></span>
				<span class="text">
					<span class="title">{item.name || t('common.none')}</span>
					<span class="sub">{[item.author, where].filter(Boolean).join(' · ')}</span>
				</span>
			</button>
		</li>
	{/each}
	{#if folders.length === 0 && scripts.length === 0}
		<li class="none">{t('common.none')}</li>
	{/if}
</ul>

<FolderNameDialog
	bind:open={nameOpen}
	folder={naming?.folder}
	parent={here?.id}
	oncreated={(id) => (current = id)}
/>

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
		<Button variant="quiet" onclick={() => (moveOpen = false)}>{t('common.cancel')}</Button>
		<Button variant="accent" icon="move" disabled={!moveOk} onclick={move}
			>{t('library.move')}</Button
		>
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
				parent: here.parent ? pathName(here.parent) : t('library.scripts')
			})}
		</p>
	{/if}
</ConfirmDialog>

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.crumbs {
		min-width: 0;
		flex: 1 1 auto;
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
	.tiles {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(14 * var(--u))), 1fr));
		gap: var(--space-2);
	}
	.tile {
		width: 100%;
		height: 100%;
		min-height: calc(1.5 * var(--tap-target));
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--surface);
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.tile:hover {
		background: var(--surface-selected);
	}
	.icon {
		display: flex;
		font-size: 1.6rem;
		color: var(--on-surface-muted);
	}
	.icon.folder {
		color: var(--accent);
	}
	.text {
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
	.none {
		color: var(--on-surface-muted);
	}
	.error {
		margin: var(--space-1) 0 0;
		min-height: 1.2em;
		font-size: 0.85rem;
		color: var(--evil);
	}
</style>
