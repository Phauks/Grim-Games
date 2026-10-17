<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
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
	<label class="term">
		<span class="visually-hidden">{t('scripts.picker.search')}</span>
		<span class="magnifier" aria-hidden="true"><Icon name="search" /></span>
		<ClearableField bind:value={term}>
			<input
				type="search"
				autocomplete="off"
				enterkeyhint="search"
				placeholder={t('scripts.picker.searchPlaceholder')}
				bind:value={term}
			/>
		</ClearableField>
	</label>
	<Select label={t('scripts.sources.label')} value={source} {options} onChange={choose} />
</div>

<style>
	.search {
		flex: 1 1 100%;
		display: grid;
		gap: var(--space-1);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.term {
		position: relative;
	}
	.magnifier {
		position: absolute;
		inset-block: 0;
		inset-inline-start: var(--space-2);
		display: grid;
		place-items: center;
		color: var(--on-surface-muted);
		pointer-events: none;
	}
	.term input {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		padding: var(--space-2);
		padding-inline-start: calc(2 * var(--space-2) + 1.25em);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
	}
</style>
