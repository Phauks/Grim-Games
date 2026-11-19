<script lang="ts">
	/**
	 * The one look for "nothing here": a list, section or slot with nothing in it, and a field
	 * with no value. Muted italic "None", left-aligned (Trevor, 2026-11-18, the day's
	 * Announcements: "None as italics is best. But left align"; 2026-11-19: every empty state
	 * is that one format, never one per feature). Where a list would be it stands as a row,
	 * inset to where a row's text starts; `inline` is the word alone, inside a value or a line.
	 * `grim/none-state` reports a "None" drawn any other way.
	 */
	import type { HTMLAttributes } from 'svelte/elements';
	import { t } from '#lib/i18n/locale.svelte.ts';

	interface Props extends Omit<HTMLAttributes<HTMLElement>, 'class'> {
		/** The element: `li` inside a list, `td` inside a table row, `span` inline. */
		as?: 'p' | 'li' | 'div' | 'span' | 'td';
		/** The word alone, no row height or inset: inside a value, a cell or a line of text. */
		inline?: boolean;
		/** Other words for nothing, when "None" would not say it (rare). */
		text?: string;
		testid?: string;
		/** As `as="td"`: the columns it spans. */
		colspan?: number;
	}

	let { as, inline = false, text, testid, ...rest }: Props = $props();
	const tag = $derived(as ?? (inline ? 'span' : 'p'));
</script>

<svelte:element
	this={tag}
	{...rest}
	class="none-state"
	data-inline={inline ? '' : undefined}
	data-testid={testid}>{text ?? t('common.none')}</svelte:element
>

<style>
	.none-state {
		display: flex;
		align-items: center;
		min-height: var(--tap-target);
		margin: 0;
		padding-block: 0;
		/* Where a row's text starts; a list whose rows start elsewhere sets --none-inset. */
		padding-inline: var(--none-inset, var(--space-3));
		color: var(--on-surface-muted);
		font-style: italic;
		font-weight: normal;
		text-align: start;
		list-style: none;
	}
	td.none-state {
		display: table-cell;
		vertical-align: middle;
	}
	.none-state[data-inline] {
		display: inline;
		min-height: 0;
		padding: 0;
	}
</style>
