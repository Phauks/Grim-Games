<script lang="ts">
	/**
	 * A row of totals, each a label over its number and an optional share in brackets: History's
	 * summary and the admins' Game history (Trevor, 2026-11-12: one look for both).
	 */
	interface Props {
		stats: readonly { label: string; value: string; share?: string }[];
		testid?: string;
	}

	let { stats, testid }: Props = $props();
</script>

<dl data-testid={testid}>
	{#each stats as stat (stat.label)}
		<div>
			<dt>{stat.label}</dt>
			<dd>
				{stat.value}
				{#if stat.share !== undefined}<span class="share">({stat.share})</span>{/if}
			</dd>
		</div>
	{/each}
</dl>

<style>
	dl {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(calc(7 * var(--u)), 1fr));
		gap: var(--space-2);
		margin: 0;
	}
	dl div {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	dt {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		white-space: nowrap;
		font-family: var(--font-heading);
		font-size: 1.3rem;
		color: var(--heading);
	}
	.share {
		font-size: 0.7em;
		color: var(--on-surface-muted);
	}
</style>
