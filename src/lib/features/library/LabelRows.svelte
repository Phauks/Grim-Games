<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import NewLabel from './NewLabel.svelte';
	import { byName, folderPath, folderTree } from './library-labels.ts';
	import { libraryLabels } from './library-labels.svelte.ts';

	/**
	 * An item's folder and tags, as `dt`/`dd` rows of its details (any kind of item). Moving
	 * works here without dragging.
	 */
	interface Props {
		/** The item's key (library-items.ts). */
		itemKey: string;
	}

	let { itemKey }: Props = $props();

	/** No folder, as a Select value (an empty value would read as nothing chosen). */
	const NO_FOLDER = 'none';
	const labels = $derived(libraryLabels.for(itemKey));
	const tags = $derived(byName(libraryLabels.state.tags));
	const folderOptions = $derived([
		{ value: NO_FOLDER, label: t('library.heading') },
		...folderTree(libraryLabels.state).map(({ folder }) => ({
			value: folder.id,
			label: folderPath(libraryLabels.state, folder.id)
				.map((f) => f.name)
				.join(' / ')
		}))
	]);
</script>

<dt class="term">{t('library.folder')}</dt>
<dd class="value" data-testid="script-labels">
	<Select
		label={t('library.folder')}
		hideLabel
		value={labels.folder ?? NO_FOLDER}
		options={folderOptions}
		onChange={(value) => libraryLabels.setFolder(itemKey, value === NO_FOLDER ? undefined : value)}
	/>
</dd>
<dt class="term">{t('library.tags')}</dt>
<dd class="value">
	<div class="toggles" role="group" aria-label={t('library.tags')}>
		{#each tags as tag (tag.id)}
			<Chip
				pressed={labels.tags.includes(tag.id)}
				onclick={() => libraryLabels.toggleTag(itemKey, tag.id)}>{tag.name}</Chip
			>
		{/each}
	</div>
	<NewLabel
		kind="tags"
		label={t('library.newTag')}
		onadd={(id) => libraryLabels.toggleTag(itemKey, id)}
	/>
</dd>

<style>
	/* Rows of the details' main info, styled as its own rows are. */
	.term {
		color: var(--on-surface-muted);
	}
	.value {
		margin: 0;
		min-width: 0;
	}
	.toggles {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
</style>
