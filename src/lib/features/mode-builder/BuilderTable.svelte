<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * One section of the Mode builder as a bordered table: a header band, then a row per
	 * setting with a line between them (Trevor, 2026-11-01: "make the sections better
	 * delineated, and not just hovering on the background. It should be a table of some kind").
	 * Rows are `BuilderRow`s: the setting's name and file key, its control, its guide link.
	 */
	interface Props {
		/** The header band's contents; left out, no band. */
		head?: Snippet;
		children: Snippet;
		/** Where it is in the file (`parts.pool`), for jumping to it from the output. */
		path?: string;
		/** A part the file leaves out: shown dimmed, every control still usable. */
		off?: boolean;
		testid?: string;
		/** `data-part`, for a part's table. */
		part?: string;
	}

	let { head, children, path, off = false, testid, part }: Props = $props();
</script>

<table
	class="builder-table"
	class:off
	data-path={path}
	data-part={part}
	data-testid={testid}
	data-off={off ? '' : undefined}
>
	{#if head}
		<thead>
			<tr>
				<th colspan="3">{@render head()}</th>
			</tr>
		</thead>
	{/if}
	<tbody>
		{@render children()}
	</tbody>
</table>

<style>
	.builder-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		border: 1px solid var(--border); /* px-ok: hairline */
		border-radius: var(--radius-sm);
		background: var(--panel-background);
		overflow: hidden;
	}
	thead th {
		padding: var(--space-1) var(--space-2);
		background: var(--surface-raised);
		border-bottom: 1px solid var(--border); /* px-ok: hairline */
		text-align: start;
		font-weight: 700;
	}
	.off thead th {
		background: none;
	}
	/* A line between rows. */
	tbody :global(tr + tr > *) {
		border-top: 1px solid var(--border); /* px-ok: hairline */
	}
	/* A part left out: its rows dimmed until one is used, which turns the part on. */
	.off tbody :global(tr > *) {
		opacity: 0.6;
	}
	.off tbody :global(tr:hover > *),
	.off tbody :global(tr:focus-within > *) {
		opacity: 1;
	}
</style>
