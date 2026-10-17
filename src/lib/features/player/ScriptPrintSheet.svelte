<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { LoadedScript, NumericNightOrder } from '#lib/core/data/index.ts';
	import {
		loadNumericNightOrder,
		loadOfficialData,
		officialData
	} from '#lib/features/characters/game-data.svelte.ts';
	import PlayerCounts from './PlayerCounts.svelte';
	import PlayerNightOrder from './PlayerNightOrder.svelte';
	import { playerJinxes, playerNight, sheetCharacters } from './player-script.ts';
	import ScriptByline from './ScriptByline.svelte';
	import ScriptSheet from './ScriptSheet.svelte';

	/**
	 * The printed script: the sheet on the front, the night order and player counts on the
	 * back (Trevor approved, 2026-10-16). Drawn on the device, so printing needs no server.
	 */
	interface Props {
		script: LoadedScript;
		version?: string;
	}

	let { script, version }: Props = $props();

	let numeric = $state<NumericNightOrder>();
	$effect(() => {
		if (!officialData.current) void loadOfficialData();
		void loadNumericNightOrder()
			.then((n) => (numeric = n))
			.catch(() => undefined);
	});
	const data = $derived(officialData.current);
	const nights = $derived(
		data ? (['first', 'other'] as const).map((n) => playerNight(script, data, n, numeric)) : []
	);
</script>

{#if data}
	<article class="print-sheet" data-testid="print-sheet">
		<section class="page">
			<header>
				<h1>{script.name}</h1>
				<ScriptByline author={script.meta.author} {version} />
			</header>
			<ScriptSheet
				characters={sheetCharacters(script, data)}
				jinxes={playerJinxes(script, data)}
				flat
			/>
		</section>
		<section class="page back">
			<!-- Title and player counts share the top, so both nights fit below them. -->
			<header class="back-head">
				<h1>{script.name}</h1>
				<div class="counts">
					<h2>{t('player.breakdown')}</h2>
					<PlayerCounts />
				</div>
			</header>
			<PlayerNightOrder {nights} />
		</section>
	</article>
{/if}

<style>
	/* Paper is light whatever the theme: dark text on white, colours kept for the teams. */
	.print-sheet {
		--surface: white;
		--surface-selected: gainsboro;
		--on-surface: black;
		--on-surface-muted: dimgray;
		--heading: black;
		--border: silver;
		background: white;
		color: black;
		print-color-adjust: exact;
		-webkit-print-color-adjust: exact;
	}
	.page + .page {
		break-before: page;
	}
	/* The back is denser than the screen's Night tab, so both nights fit one side of paper. */
	.back {
		--u: 0.45rem;
		font-size: 0.66rem;
	}
	.back :global(.icon > *) {
		width: 100%;
		height: 100%;
	}
	.back :global(.nights) {
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}
	.back :global(.nights h2) {
		font-size: 0.95rem;
	}
	.back :global(.nights ol) {
		gap: 0;
	}
	.back :global(.nights .text) {
		font-size: 0.62rem;
		line-height: 1.15;
	}
	.back :global(.nights .name) {
		font-size: 0.72rem;
		min-height: 0;
		line-height: 1.15;
	}
	.back :global(.nights li) {
		column-gap: calc(0.5 * var(--u));
	}
	.back :global(table) {
		font-size: 0.6rem;
	}
	.back :global(th),
	.back :global(td) {
		padding: 0 calc(0.4 * var(--u));
	}
	.back :global(.count) {
		min-width: 0;
		min-height: 0;
	}
	header {
		margin-bottom: var(--space-3);
	}
	.back header {
		margin-bottom: var(--space-1);
	}
	h1 {
		margin: 0;
		font-size: 1.6rem;
	}
	.back-head {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: var(--space-3);
	}
	.counts h2 {
		margin: 0;
		font-size: 0.8rem;
	}
</style>
