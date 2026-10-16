<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { SEATED_TYPES, type SetupAnalysis } from '#lib/core/rules/index.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';

	interface Props {
		analysis: SetupAnalysis;
		/** Travellers selected. */
		travellers: number;
	}

	let { analysis, travellers }: Props = $props();

	function range(values: readonly number[]): string {
		if (values.length === 1) return String(values[0]);
		const contiguous = values.every((v, i) => i === 0 || v === values[i - 1] + 1);
		return contiguous ? `${values[0]}–${values.at(-1)}` : values.join(` ${t('setup.or')} `);
	}
</script>

<!-- Chosen against expected for each type; every cell keeps its size whatever the numbers. -->
<dl class="counts" data-testid="setup-counts">
	{#each SEATED_TYPES as type (type)}
		{@const ok = analysis.expected[type].includes(analysis.chosen[type])}
		<div class="cell" data-type={type} data-ok={ok ? '' : undefined}>
			<dt>{TYPE_PLURALS[type]}</dt>
			<dd>
				<span class="chosen" data-testid="count-{type}">{analysis.chosen[type]}</span><span
					class="of">/ {range(analysis.expected[type])}</span
				>
			</dd>
		</div>
	{/each}
	<div
		class="cell"
		data-type="traveller"
		data-ok={travellers === analysis.travellers ? '' : undefined}
	>
		<dt>{TYPE_PLURALS.traveller}</dt>
		<dd>
			<span class="chosen" data-testid="count-traveller">{travellers}</span><span class="of"
				>/ {analysis.travellers}</span
			>
		</dd>
	</div>
</dl>

<style>
	.counts {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: var(--space-1);
		margin: 0;
	}
	.cell {
		display: grid;
		justify-items: center;
		padding: var(--space-1);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		box-shadow: inset 0 0 0 2px var(--accent);
		text-align: center;
	}
	.cell[data-ok] {
		box-shadow: none;
	}
	dt {
		font-size: 0.72rem;
		opacity: 0.85;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
	dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.chosen {
		font-weight: 700;
		font-size: 1.1rem;
	}
	.of {
		margin-inline-start: 0.2em;
		font-size: 0.8rem;
		opacity: 0.8;
	}
</style>
