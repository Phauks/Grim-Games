<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	/**
	 * One row of a Mode builder table: the setting's name with the file's key for it under it,
	 * its control, and a link to the format guide's row for it (Trevor, 2026-11-01: "each
	 * setting should have a link to the specific part of the mode creation guide"), which
	 * stands in for a description under the label. On a phone the name goes above the control.
	 */
	interface Props {
		label: string;
		/** The file's key, shown in the coding font. */
		name: string;
		/** Where it is in the file, as a problem names it (`parts.pool.count`). */
		path?: string;
		/** The label's id, for a control labelled by it. */
		labelId?: string;
		/** Opens the format guide at this setting; left out, no link. */
		onGuide?: () => void;
		children: Snippet;
		/** `data-field`. */
		field?: string;
	}

	let { label, name, path, labelId, onGuide, children, field }: Props = $props();
</script>

<tr class="row" data-path={path} data-field={field}>
	<th scope="row">
		<span id={labelId}>{label}</span>
		<code>{name}</code>
	</th>
	<td class="control">{@render children()}</td>
	<td class="guide">
		{#if onGuide}
			<IconButton
				icon="glossary"
				label={t('modes.builder.guideFor', { setting: label })}
				onclick={onGuide}
			/>
		{/if}
	</td>
</tr>

<style>
	th,
	td {
		padding: var(--space-1) var(--space-2);
		text-align: start;
		vertical-align: middle;
	}
	th {
		width: 36%;
		font-weight: 600;
	}
	th span {
		display: block;
		overflow-wrap: anywhere;
	}
	code {
		color: var(--on-surface-muted);
		font-size: 0.8em;
		font-weight: 400;
		overflow-wrap: anywhere;
	}
	.control {
		min-width: 0;
	}
	.guide {
		width: calc(var(--u) * 5);
		text-align: end;
	}
	/* A phone: the name across the top, then the control and its guide link. */
	@container builder (max-width: 34rem) {
		.row {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
		}
		th {
			grid-column: 1 / -1;
			width: auto;
			padding-bottom: 0;
		}
		th span,
		th code {
			display: inline;
			margin-inline-end: var(--space-1);
		}
		.row > td {
			border-top: 0;
		}
	}
</style>
