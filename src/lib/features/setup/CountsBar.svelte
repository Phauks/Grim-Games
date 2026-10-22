<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { SEATED_TYPES, type SeatedType, type SetupAnalysis } from '#lib/core/rules/index.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';

	interface Props {
		analysis: SetupAnalysis;
		/** Travellers selected. */
		travellers: number;
		/** The Travellers allowed when a special rule puts some in the bag (Stowed Away). */
		travellerLimits?: { min: number; max: number };
	}

	let { analysis, travellers, travellerLimits }: Props = $props();
	const travellersOk = $derived(
		travellerLimits
			? travellers >= travellerLimits.min && travellers <= travellerLimits.max
			: travellers === analysis.travellers
	);
	const travellersExpected = $derived(
		travellerLimits
			? range(
					Array.from(
						{ length: travellerLimits.max - travellerLimits.min + 1 },
						(_, i) => travellerLimits.min + i
					)
				)
			: String(analysis.travellers)
	);

	/**
	 * Tapping a type's count shows where it comes from (Trevor, 2026-10-20): the setup sheet's
	 * count, each change to it, and what is expected and chosen. One popover for all four.
	 */
	let infoOpen = $state(false);
	let infoType = $state<SeatedType>('townsfolk');
	let infoAnchor = $state<HTMLElement>();
	function showInfo(type: SeatedType, anchor: HTMLElement) {
		infoType = type;
		infoAnchor = anchor;
		infoOpen = true;
	}

	function range(values: readonly number[]): string {
		if (values.length === 1) return String(values[0]);
		const contiguous = values.every((v, i) => i === 0 || v === values[i - 1] + 1);
		return contiguous ? `${values[0]}–${values.at(-1)}` : values.join(` ${t('setup.or')} `);
	}
</script>

<!--
	Chosen against expected for each type; every cell keeps its size whatever the numbers.
	Each seated type's cell is a button that opens where its count comes from.
-->
<div class="counts" data-testid="setup-counts">
	{#each SEATED_TYPES as type (type)}
		{@const ok = analysis.expected[type].includes(analysis.chosen[type])}
		<button
			type="button"
			class="cell"
			data-type={type}
			data-ok={ok ? '' : undefined}
			aria-haspopup="dialog"
			title={t('setup.countInfo', { type: TYPE_PLURALS[type] })}
			data-testid="count-info-{type}"
			onclick={(event) => showInfo(type, event.currentTarget)}
		>
			<span class="label">{TYPE_PLURALS[type]}</span>
			<span class="value"
				><span class="chosen" data-testid="count-{type}">{analysis.chosen[type]}</span><span
					class="of">/ {range(analysis.expected[type])}</span
				></span
			>
		</button>
	{/each}
	<div class="cell" data-type="traveller" data-ok={travellersOk ? '' : undefined}>
		<span class="label">{TYPE_PLURALS.traveller}</span>
		<span class="value"
			><span class="chosen" data-testid="count-traveller">{travellers}</span><span class="of"
				>/ {travellersExpected}</span
			></span
		>
	</div>
</div>

<Popover bind:open={infoOpen} title={TYPE_PLURALS[infoType]} anchor={infoAnchor}>
	<div class="why" data-testid="count-info">
		<p class="row">
			<span>{t('setup.countInfo.sheet', { players: analysis.dealt })}</span><span class="n"
				>{analysis.base[infoType]}</span
			>
		</p>
		{#if analysis.reasons[infoType].length}
			<ul class="reasons">
				{#each analysis.reasons[infoType] as reason (reason)}<li>
						<GlossaryText text={reason} />
					</li>{/each}
			</ul>
		{/if}
		<p class="row">
			<span>{t('setup.countInfo.expected')}</span><span class="n"
				>{range(analysis.expected[infoType])}</span
			>
		</p>
		<p class="row">
			<span>{t('setup.countInfo.chosen')}</span><span class="n">{analysis.chosen[infoType]}</span>
		</p>
	</div>
</Popover>

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
	/* A type's cell opens its count's popup; it looks as the Travellers' does. */
	button.cell {
		border: 0;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.why {
		display: grid;
		gap: var(--space-1);
		min-width: calc(14 * var(--u));
		font-size: 0.9rem;
	}
	.row {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		margin: 0;
	}
	.n {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.reasons {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding-inline-start: 1.2em;
		opacity: 0.9;
	}
</style>
