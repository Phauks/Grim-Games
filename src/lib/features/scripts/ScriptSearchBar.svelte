<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { keepSource, PAGE_SOURCES, type PageSource } from './search-sources.ts';

	/** Search's search box and its one source, in the page's toolbar. */
	interface Props {
		term: string;
		source: PageSource;
	}

	let { term = $bindable(), source = $bindable() }: Props = $props();

	const options = $derived(
		PAGE_SOURCES.map((value) => ({ value, label: t(`scripts.picker.source.${value}`) }))
	);

	function choose(next: PageSource) {
		if (next === source) return;
		source = next;
		keepSource(next);
	}
</script>

<div class="search">
	<SearchField
		bind:value={term}
		label={t('scripts.picker.search')}
		placeholder={t('scripts.picker.searchPlaceholder')}
	/>
	<Select label={t('scripts.sources.label')} value={source} {options} onChange={choose} />
</div>

<style>
	.search {
		flex: 1 1 100%;
		display: grid;
		gap: var(--space-1);
	}
</style>
