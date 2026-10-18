<script lang="ts" module>
	export type Place = 'files' | 'campaigns';
</script>

<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';
	import TagList from './TagList.svelte';
	import { TOP_FOLDER } from './drag-to-folder.ts';
	import type { KindFilter } from './library-items.ts';
	import { folderTree } from './library-labels.ts';
	import { libraryLabels } from './library-labels.svelte.ts';

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
	}

	let {
		current = $bindable(),
		kind = $bindable('all'),
		place = $bindable('files'),
		tags = $bindable([])
	}: Props = $props();

	const tree = $derived(folderTree(libraryLabels.state));
	const kinds: { value: KindFilter; label: string; icon: IconSlot }[] = $derived([
		{ value: 'all', label: t('library.kind.all'), icon: 'library' },
		{ value: 'script', label: t('library.kind.scripts'), icon: 'script' },
		{ value: 'character', label: t('library.kind.characters'), icon: 'buildCharacter' },
		{ value: 'collection', label: t('library.kind.collections'), icon: 'players' }
	]);

	function openFolder(id: string | undefined) {
		current = id;
		place = 'files';
	}
</script>

<nav class="sidebar" aria-label={t('library.navigation')} data-testid="library-sidebar">
	<section aria-labelledby="library-nav-folders">
		<h2 id="library-nav-folders" class="heading">{t('library.folders')}</h2>
		<ul>
			<li>
				<button
					type="button"
					class="entry"
					data-drop-folder={TOP_FOLDER}
					aria-current={place === 'files' && current === undefined ? 'location' : undefined}
					onclick={() => openFolder(undefined)}
				>
					<Icon name="library" />
					<span class="name">{t('library.heading')}</span>
				</button>
			</li>
			{#each tree as { folder, depth } (folder.id)}
				<li style:--depth={depth + 1}>
					<button
						type="button"
						class="entry nested"
						data-drop-folder={folder.id}
						aria-current={place === 'files' && current === folder.id ? 'location' : undefined}
						onclick={() => openFolder(folder.id)}
					>
						<Icon name="folder" />
						<span class="name">{folder.name}</span>
					</button>
				</li>
			{/each}
		</ul>
	</section>

	<section aria-labelledby="library-nav-kinds">
		<h2 id="library-nav-kinds" class="heading">{t('library.kinds')}</h2>
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
	</section>

	<section aria-labelledby="library-nav-tags">
		<h2 id="library-nav-tags" class="heading">{t('library.tags')}</h2>
		<TagList bind:filter={tags} />
	</section>
</nav>

<style>
	.sidebar {
		display: grid;
		align-content: start;
		gap: var(--space-4);
		min-width: 0;
	}
	section {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
	}
	.heading {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
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
		grid-template-columns: auto minmax(0, 1fr);
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
	.nested {
		padding-inline-start: calc(var(--space-2) + var(--depth, 1) * var(--space-3));
	}
	.entry:hover {
		background: var(--surface-selected);
	}
	.entry[aria-current],
	.entry[aria-pressed='true'] {
		background: var(--surface-selected);
		font-weight: 600;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
