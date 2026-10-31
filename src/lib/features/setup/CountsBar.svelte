<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { SEATED_TYPES, type SeatedType, type SetupAnalysis } from '#lib/core/rules/index.ts';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { typeTone } from '#lib/core/data/character-type.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import SetupTable from './SetupTable.svelte';

	interface Props {
		analysis: SetupAnalysis;
		/** Travellers selected. */
		travellers: number;
		/** The Travellers allowed when a special rule puts some in the bag (Stowed Away). */
		travellerLimits?: { min: number; max: number };
		/**
		 * In a game (the Script tab's Players section): only the numbers this table plays with,
		 * everyone first, then each type's count from the sheet and any setup change the town
		 * knows of (Trevor, 2026-10-27). Nothing chosen is shown.
		 */
		game?: boolean;
		/** The most players the script is made for (Teensyville: 6), for the setup sheet. */
		maxPlayers?: number;
	}

	let { analysis, travellers, travellerLimits, game = false, maxPlayers }: Props = $props();

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
	 * Tapping the open one's cell again closes it (Trevor, 2026-10-28). In a game, everyone's
	 * count opens the whole setup sheet in the same popover (Trevor, 2026-10-28).
	 */
	let infoOpen = $state(false);
	let infoType = $state<SeatedType | 'players'>('townsfolk');
	let infoAnchor = $state<HTMLElement>();
	function showInfo(type: SeatedType | 'players', anchor: HTMLElement) {
		if (infoOpen && infoAnchor === anchor) {
			infoOpen = false;
			return;
		}
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
<div class="counts" class:game data-testid={game ? 'game-counts' : 'setup-counts'}>
	{#if game}
		<button
			type="button"
			class="cell everyone"
			data-ok=""
			aria-haspopup="dialog"
			title={t('setup.sheet')}
			data-testid="count-info-players"
			onclick={(event) => showInfo('players', event.currentTarget)}
		>
			<span class="label">{t('setup.players')}</span>
			<span class="value"
				><span class="chosen" data-testid="count-players">{analysis.players}</span></span
			>
		</button>
	{/if}
	{#each SEATED_TYPES as type (type)}
		{@const ok = game || analysis.expected[type].includes(analysis.chosen[type])}
		<button
			type="button"
			class="cell"
			data-type={type}
			data-type-band={typeTone(type)}
			data-ok={ok ? '' : undefined}
			aria-haspopup="dialog"
			title={t('setup.countInfo', { type: TYPE_PLURALS[type] })}
			data-testid="count-info-{type}"
			onclick={(event) => showInfo(type, event.currentTarget)}
		>
			<span class="label">{TYPE_PLURALS[type]}</span>
			{#if game}
				<span class="value"
					><span class="chosen" data-testid="count-{type}">{range(analysis.expected[type])}</span
					></span
				>
			{:else}
				<span class="value"
					><span class="chosen" data-testid="count-{type}">{analysis.chosen[type]}</span><span
						class="of">/ {range(analysis.expected[type])}</span
					></span
				>
			{/if}
		</button>
	{/each}
	<div
		class="cell"
		data-type="traveller"
		data-type-band="traveller"
		data-ok={game || travellersOk ? '' : undefined}
	>
		<span class="label">{TYPE_PLURALS.traveller}</span>
		<span class="value"
			><span class="chosen" data-testid="count-traveller">{travellers}</span>{#if !game}<span
					class="of">/ {travellersExpected}</span
				>{/if}</span
		>
	</div>
</div>

<Popover
	bind:open={infoOpen}
	title={infoType === 'players' ? t('setup.sheet') : TYPE_PLURALS[infoType]}
	anchor={infoAnchor}
>
	{#if infoType === 'players'}
		<!-- The dealt players' column: Travellers aren't on the sheet. -->
		<div class="sheet" data-testid="count-sheet">
			<SetupTable players={analysis.dealt} {maxPlayers} />
		</div>
	{:else}
		{@const type = infoType}
		<div class="why" data-testid="count-info">
			<p class="row">
				<span>{t('setup.countInfo.sheet', { players: analysis.dealt })}</span><span class="n"
					>{analysis.base[type]}</span
				>
			</p>
			{#if analysis.reasons[type].length}
				<ul class="reasons">
					{#each analysis.reasons[type] as reason (reason)}<li>
							<GlossaryText text={reason} />
						</li>{/each}
				</ul>
			{/if}
			<p class="row">
				<span>{t('setup.countInfo.expected')}</span><span class="n"
					>{range(analysis.expected[type])}</span
				>
			</p>
			{#if !game}<p class="row">
					<span>{t('setup.countInfo.chosen')}</span><span class="n">{analysis.chosen[type]}</span>
				</p>{/if}
		</div>
	{/if}
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
	/* Each type's box in its tokens' colour (Trevor, 2026-10-31, "B · Band"); a count that
	   doesn't match yet is ringed in gold, which reads on the blue and red alike (Trevor:
	   "make the warnings a different color perhaps, like gold"). */
	.cell[data-type-band] {
		background: var(--type-band);
		color: var(--on-type-band);
		box-shadow: inset 0 0 0 3px var(--count-warn);
	}
	.cell[data-type-band][data-ok] {
		box-shadow: var(--button-ring);
	}
	.label {
		font-size: 0.72rem;
		opacity: 0.85;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
	.value {
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
	/* In a game every number is in a box (Trevor, 2026-10-27), on any sheet background. */
	.counts.game {
		grid-template-columns: repeat(6, minmax(0, 1fr));
	}
	.game .cell {
		box-shadow: inset 0 0 0 1px var(--border);
	}
	.game .label {
		font-size: 0.66rem;
	}
	/* Everyone at the table in gold, as the setup sheet's own column is. */
	.game .everyone {
		background: var(--count-current);
		color: var(--on-count-current);
		box-shadow: none;
	}
	/* A type's cell opens its count's popup; it looks as the Travellers' does. */
	button.cell {
		min-width: 0;
		border: 0;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	/* The popover is narrower than the sheet's own section: a slimmer type column keeps "15+"
	   on one line. */
	.sheet :global(th[scope='row']) {
		width: 5em;
	}
	.sheet :global(thead th) {
		white-space: nowrap;
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
