<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import DataTree from './DataTree.svelte';

	/**
	 * A JSON value as readable rows (the Character reference's Data view): an object's keys as
	 * labels beside their values, a list as numbered items, a list of plain values on one line,
	 * nothing as "None". Keys are the file's own, only spaced out ("firstNight" → "First night").
	 */
	interface Props {
		value: unknown;
	}

	let { value }: Props = $props();

	function label(key: string): string {
		const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2');
		return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
	}

	const isPlain = (v: unknown) => v === null || typeof v !== 'object';
	const entries = $derived(
		value !== null && typeof value === 'object' && !Array.isArray(value)
			? Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
			: []
	);
</script>

{#snippet plain(v: unknown)}{#if v === null || v === undefined}<span class="none"
			>{t('common.none')}</span
		>{:else if typeof v === 'boolean'}{t(
			v ? 'reference.data.yes' : 'reference.data.no'
		)}{:else}{String(v)}{/if}{/snippet}

{#if Array.isArray(value)}
	{#if value.length === 0}
		{@render plain(null)}
	{:else if value.every(isPlain)}
		{value.map((v) => String(v)).join(', ')}
	{:else}
		<ol class="list">
			{#each value as item, i (i)}<li><DataTree value={item} /></li>{/each}
		</ol>
	{/if}
{:else if value !== null && typeof value === 'object'}
	{#if entries.length === 0}
		{@render plain(null)}
	{:else}
		<dl class="rows">
			{#each entries as [key, v] (key)}
				<div class="row" data-key={key}>
					<dt>{label(key)}</dt>
					<dd><DataTree value={v} /></dd>
				</div>
			{/each}
		</dl>
	{/if}
{:else}
	{@render plain(value)}
{/if}

<style>
	.rows,
	.list {
		display: grid;
		margin: 0;
		padding: 0;
	}
	/* Label beside its value when there is room, above it when not. */
	.row {
		display: grid;
		grid-template-columns: minmax(calc(6 * var(--u)), max-content) 1fr;
		gap: var(--space-1) var(--space-3);
		padding: var(--space-1) 0;
		border-top: 1px solid var(--border);
	}
	.row:first-child {
		border-top: 0;
	}
	@container data-view (max-width: 30rem) {
		.row {
			grid-template-columns: 1fr;
			gap: 0;
		}
		/* Stacked, a nested block is indented under its label so it reads as that label's. */
		dd > :global(.rows) {
			padding-inline-start: var(--space-2);
			border-inline-start: 2px solid var(--border);
		}
	}
	dt {
		color: var(--on-surface-muted);
		font-weight: 600;
	}
	dd {
		min-width: 0;
		margin: 0;
		overflow-wrap: anywhere;
	}
	.list {
		gap: var(--space-1);
		padding-inline-start: 1.5em;
	}
	/* A nested object sits in its own indented block under its number. */
	.list > li {
		padding-inline-start: var(--space-2);
		border-inline-start: 2px solid var(--border);
	}
	.none {
		color: var(--on-surface-muted);
	}
</style>
