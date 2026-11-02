<script lang="ts" module>
	export type Place = 'files' | 'campaigns';
</script>

<script lang="ts">
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import SectionStack from '#lib/ui/layout/SectionStack.svelte';
	import TagList from './TagList.svelte';
	import { TOP_FOLDER, dragToFolder, type DragSource } from './drag-to-folder.ts';
	import type { KindFilter } from './library-items.ts';
	import { folderTree } from './library-labels.ts';
	import { libraryLabels } from './library-labels.svelte.ts';
	import { readStored, writeStored } from '#lib/ui/stored.ts';

	/**
	 * The Library's file navigation (Trevor, 2026-10-18: "a left sidebar for navigating the
	 * different files"): the folder tree, each folder a place to drop a dragged item; the kinds
	 * of item; Campaigns; and the tags.
	 */
	interface Props {
		/** The open folder; the top level when none. */
		current?: string;
		kind?: KindFilter;
		place?: Place;
		tags?: string[];
		/** What a folder holds, shown beside it (Trevor, 2026-10-18); the top level when none. */
		count: (folder: string | undefined) => number;
		/** New folder, in the Folders heading (Trevor, 2026-10-18). */
		onnewfolder: () => void;
		/** A folder dragged onto another, or onto the top level (Trevor, 2026-10-18). */
		onmove: (source: DragSource, target: string | undefined) => void;
		/** F2 on a folder renames it where it is (Trevor, 2026-10-18: "from outside the folder"). */
		onrename: (folder: string) => void;
		/** False leaves out the Kinds list and Campaigns, for a browser of one kind of item. */
		kinds?: boolean;
	}

	let {
		current = $bindable(),
		kind = $bindable('all'),
		place = $bindable('files'),
		tags = $bindable([]),
		count,
		onnewfolder,
		onmove,
		onrename,
		kinds: showKinds = true
	}: Props = $props();

	/** Folders shown closed, their folders hidden (Trevor, 2026-10-18: collapsible), per device. */
	const CLOSED_KEY = 'grim-games:library-closed-folders';
	const stored = readStored<unknown>(CLOSED_KEY);
	let closed = $state<string[]>(
		Array.isArray(stored) ? stored.filter((v): v is string => typeof v === 'string') : []
	);

	function toggleOpen(id: string) {
		closed = closed.includes(id) ? closed.filter((c) => c !== id) : [...closed, id];
		writeStored(CLOSED_KEY, closed);
	}

	const all = $derived(folderTree(libraryLabels.state));
	const parents = $derived(new Set(all.map(({ folder }) => folder.parent).filter(Boolean)));
	/** The tree without folders inside a closed one. */
	const tree = $derived.by(() => {
		let hideBelow = Infinity;
		return all.filter(({ folder, depth }) => {
			if (depth > hideBelow) return false;
			hideBelow = closed.includes(folder.id) ? depth : Infinity;
			return true;
		});
	});
	const kinds: { value: KindFilter; label: string; icon: IconSlot }[] = $derived([
		{ value: 'all', label: t('library.kind.all'), icon: 'library' },
		{ value: 'script', label: t('library.kind.scripts'), icon: 'script' },
		{ value: 'character', label: t('library.kind.characters'), icon: 'buildCharacter' },
		{ value: 'collection', label: t('library.kind.collections'), icon: 'players' },
		{ value: 'mode', label: t('library.kind.modes'), icon: 'buildMode' },
		{ value: 'rule', label: t('library.kind.rules'), icon: 'specialRule' }
	]);

	function openFolder(id: string | undefined) {
		current = id;
		place = 'files';
	}
</script>

<!-- Folders, Kinds and Tags fold away like every other section, remembered on this device. -->
<nav class="sidebar" aria-label={t('library.navigation')} data-testid="library-sidebar">
	<SectionStack edge>
		<Collapsible title={t('library.folders')} storageKey="library-folders">
			{#snippet aside()}
				<IconButton icon="add" label={t('library.newFolder')} onclick={onnewfolder} />
			{/snippet}
			<ul class="tree">
				<li>
					<button
						type="button"
						class="entry"
						data-drop-folder={TOP_FOLDER}
						aria-current={place === 'files' && current === undefined ? 'location' : undefined}
						onclick={() => openFolder(undefined)}
					>
						<!-- Home, with the folder path's icon (Trevor, 2026-10-19: "to match"). -->
						<Icon name="home" />
						<span class="name">{t('library.home')}</span>
						<span class="count"><CountBadge count={count(undefined)} /></span>
					</button>
				</li>
				{#each tree as { folder, depth } (folder.id)}
					{@const open = !closed.includes(folder.id)}
					<li class="folder" style:--depth={depth}>
						{#if parents.has(folder.id)}
							<button
								type="button"
								class="caret"
								class:closed={!open}
								aria-expanded={open}
								aria-label={t('library.showFoldersIn', { name: folder.name })}
								data-caret
								onclick={() => toggleOpen(folder.id)}
							>
								<!-- eslint-disable-next-line grim/caret-section -- a folder tree's own expander, not a section; every folder row is ruled off from the next (Trevor, 2026-10-27) -->
								<Icon name="expand" />
							</button>
						{:else}
							<span class="caret"></span>
						{/if}
						<button
							type="button"
							class="entry"
							data-drop-folder={folder.id}
							aria-current={place === 'files' && current === folder.id ? 'location' : undefined}
							onclick={() => openFolder(folder.id)}
							onkeydown={(e) => {
								if (e.key !== 'F2') return;
								e.preventDefault();
								onrename(folder.id);
							}}
							use:dragToFolder={{
								source: { id: folder.id, folder: true, label: folder.name },
								onmove
							}}
						>
							<Icon name="folder" />
							<span class="name">{folder.name}</span>
							<span class="count"><CountBadge count={count(folder.id)} /></span>
						</button>
					</li>
				{/each}
			</ul>
		</Collapsible>

		{#if showKinds}
			<Collapsible title={t('library.kinds')} storageKey="library-kinds">
				<ul>
					{#each kinds as k (k.value)}
						<li>
							<button
								type="button"
								class="entry"
								aria-pressed={place === 'files' && kind === k.value}
								onclick={() => {
									kind = k.value;
									place = 'files';
								}}
							>
								<Icon name={k.icon} />
								<span class="name">{k.label}</span>
							</button>
						</li>
					{/each}
					<li>
						<!-- Each version of a living script (Trevor, 2026-10-18). -->
						<button
							type="button"
							class="entry"
							aria-pressed={place === 'campaigns'}
							onclick={() => (place = 'campaigns')}
						>
							<Icon name="history" />
							<span class="name">{t('library.campaigns')}</span>
						</button>
					</li>
				</ul>
			</Collapsible>
		{/if}

		<TagList bind:filter={tags} />
	</SectionStack>
</nav>

<style>
	.sidebar {
		display: grid;
		align-content: start;
		min-width: 0;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: var(--space-1);
	}
	.entry {
		width: 100%;
		min-height: var(--tap-target);
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		padding: 0 var(--space-2);
		border: var(--card-border);
		border-color: transparent;
		border-radius: var(--radius-sm);
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	/* A line between folders, as between every caret's neighbours (Trevor, 2026-10-27). */
	.tree {
		gap: 0;
	}
	.tree > li + li {
		border-top: 1px solid var(--border);
	}
	/* A folder: its caret, indented by depth, then the folder itself. */
	.folder {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		padding-inline-start: calc(var(--depth, 0) * var(--space-3));
	}
	.caret {
		display: grid;
		place-items: center;
		width: calc(1.25 * var(--space-4));
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font: inherit;
		cursor: pointer;
		transition: transform 0.15s;
	}
	span.caret {
		cursor: default;
	}
	.caret.closed {
		transform: rotate(-90deg);
	}
	.count {
		display: flex;
		font-size: 0.8rem;
	}
	.entry:hover {
		background: var(--surface-selected);
	}
	.entry[aria-current],
	.entry[aria-pressed='true'] {
		background: var(--surface-selected);
		font-weight: 600;
	}
	/* The open folder, marked like the open row and the pane. */
	.entry[aria-current] {
		box-shadow: inset 0.25rem 0 0 var(--accent);
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
