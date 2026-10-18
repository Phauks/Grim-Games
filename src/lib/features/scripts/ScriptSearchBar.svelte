<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { GROUPED_SOURCES, keepSource, SOURCE_GROUP, type PageSource } from './search-sources.ts';

	/**
	 * Search's search box (`part="search"`, the page's toolbar) or its one source
	 * (`part="source"`, at the end of the page's title row: Trevor, 2026-10-18).
	 */
	interface Props {
		part: 'search' | 'source';
		term?: string;
		source: PageSource;
	}

	let { part, term = $bindable(''), source = $bindable() }: Props = $props();

	const options = $derived(
		GROUPED_SOURCES.map((value) => ({
			value,
			label: t(`scripts.picker.source.${value}`),
			group: t(`scripts.sources.group.${SOURCE_GROUP[value]}`)
		}))
	);

	function choose(next: PageSource) {
		if (next === source) return;
		source = next;
		keepSource(next);
	}
</script>

{#if part === 'search'}
	<div class="search">
		<SearchField
			bind:value={term}
			label={t('scripts.picker.search')}
			placeholder={t('scripts.picker.searchPlaceholder')}
		/>
	</div>
{:else}
	<!-- Its name is read out; the title row has no room for a label above it. -->
	<div class="source">
		<Select
			label={t('scripts.sources.label')}
			hideLabel
			value={source}
			{options}
			onChange={choose}
		/>
	</div>
{/if}

<style>
	.search {
		flex: 1 1 100%;
		display: grid;
		gap: var(--space-1);
	}
	/* Room for the longest source name, never wider than the row. */
	.source {
		width: 17rem;
		max-width: 100%;
	}
</style>
