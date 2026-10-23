<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { LoadedScript, NumericNightOrder } from '#lib/core/data/index.ts';
	import {
		loadNumericNightOrder,
		loadOfficialData,
		officialData
	} from '#lib/features/characters/game-data.svelte.ts';
	import SetupTable from '#lib/features/setup/SetupTable.svelte';
	import PlayerNightOrder from './PlayerNightOrder.svelte';
	import { playerJinxes, playerNight, sheetCharacters } from './player-script.ts';
	import NightStrip from './NightStrip.svelte';
	import ScriptByline from './ScriptByline.svelte';
	import ScriptSheet from './ScriptSheet.svelte';
	import { tick } from 'svelte';
	import {
		PRINT_DEFAULTS,
		type PrintSettings,
		type SheetDensity
	} from './player-settings.svelte.ts';

	/**
	 * The printed script: the sheet on the front, the night order and player counts on the
	 * back (Trevor approved, 2026-10-16). Drawn on the device, so printing needs no server.
	 *
	 * Each side is one page (Trevor, 2026-10-18): every character fits on the front in one or
	 * two columns, and both nights with their text plus the player counts fit on the back.
	 * `fit()` tries one column, then two, then denser sheets, then zooms each side to fit.
	 */
	interface Props {
		script: LoadedScript;
		version?: string;
		/** The reader's choices from the Print screen (Trevor, 2026-10-19). */
		settings?: PrintSettings;
	}

	let { script, version, settings = PRINT_DEFAULTS }: Props = $props();

	let numeric = $state<NumericNightOrder>();
	$effect(() => {
		if (!officialData.current) void loadOfficialData();
		void loadNumericNightOrder()
			.then((n) => (numeric = n))
			.catch(() => undefined);
	});
	const data = $derived(officialData.current);
	const characters = $derived(data ? sheetCharacters(script, data) : []);
	const jinxes = $derived(data ? playerJinxes(script, data) : []);
	// With the info back, the rule characters move there and the front keeps the players' own.
	const ruleCharacter = (c: { type: string }) => c.type === 'fabled' || c.type === 'loric';
	const frontCharacters = $derived(
		settings.back === 'info' ? characters.filter((c) => !ruleCharacter(c)) : characters
	);
	const nights = $derived(
		data ? (['first', 'other'] as const).map((n) => playerNight(script, data, n, numeric)) : []
	);

	const LAYOUTS: readonly [1 | 2, SheetDensity][] = [
		[1, 'normal'],
		[2, 'normal'],
		[2, 'compact'],
		[2, 'super']
	];
	let columns = $state<1 | 2>(2);
	let density = $state<SheetDensity>('normal');
	let frontZoom = $state(1);
	let backZoom = $state(1);
	let front = $state<HTMLElement>();
	let back = $state<HTMLElement>();
	const fits = (page: HTMLElement) => page.scrollHeight <= page.clientHeight + 1;

	/**
	 * The largest zoom, up to `max`, at which a side fits its page. A search, since text
	 * rewraps as it shrinks: a smaller zoom gives the lines more room.
	 */
	async function zoomToFit(page: HTMLElement, zoom: (z: number) => void, max: number) {
		const fitsAt = async (z: number) => {
			zoom(z);
			await tick();
			return fits(page);
		};
		if (await fitsAt(max)) return;
		let lo = 0.2;
		let hi = max;
		for (let i = 0; i < 8; i++) {
			const mid = (lo + hi) / 2;
			if (await fitsAt(mid)) lo = mid;
			else hi = mid;
		}
		zoom(lo);
		await tick();
	}

	/** Lays both sides out to one page each; call once the sheet and its icons have loaded. */
	export async function fit() {
		await loadNumericNightOrder().catch(() => undefined);
		await tick();
		if (front) {
			frontZoom = 1;
			// A fixed choice keeps only the layouts with it; Automatic tries them all.
			const fixedColumns =
				settings.columns === 'auto' ? undefined : settings.columns === 'one' ? 1 : 2;
			const fixedDensity = settings.density === 'auto' ? undefined : settings.density;
			const layouts = LAYOUTS.filter(
				([c, d]) => (!fixedColumns || c === fixedColumns) && (!fixedDensity || d === fixedDensity)
			);
			const tried: readonly (readonly [1 | 2, SheetDensity])[] = layouts.length
				? layouts
				: [[fixedColumns ?? 2, fixedDensity ?? 'normal']];
			for (const [c, d] of tried) {
				columns = c;
				density = d;
				await tick();
				if (fits(front)) break;
			}
			// Then as large as fits: a sheet that fits with room to spare grows to fill the page.
			await zoomToFit(front, (z) => (frontZoom = z), 1.3);
		}
		// The back's type starts small, so a short night order grows to fill its page.
		if (back) await zoomToFit(back, (z) => (backZoom = z), 1.5);
	}
</script>

{#if data}
	<article class="print-sheet" data-testid="print-sheet">
		{#snippet frontSide()}
			<!-- Night order down both sides, first night left (Ravenswood's idea, Trevor 2026-10-19). -->
			<div class="fit" class:with-strips={settings.nightStrips} style:zoom={frontZoom}>
				{#if settings.nightStrips && nights[0]}<NightStrip night={nights[0]} />{/if}
				<div class="main">
					<header>
						<h1>{script.name}</h1>
						<ScriptByline author={script.meta.author} {version} />
					</header>
					<ScriptSheet
						characters={frontCharacters}
						{jinxes}
						showJinxes={settings.jinxes}
						{density}
						flat
					/>
				</div>
				{#if settings.nightStrips && nights[1]}<NightStrip night={nights[1]} />{/if}
			</div>
		{/snippet}
		<section class="page front" bind:this={front} data-columns={columns}>
			{@render frontSide()}
		</section>
		<!-- One character sheet per player; each is the first one again. -->
		{#each { length: settings.copies - 1 }, i (i)}
			<section class="page front" data-columns={columns} data-copy>
				{@render frontSide()}
			</section>
		{/each}
		{#if settings.back === 'info'}
			<section class="page back" bind:this={back} data-back="info">
				<div class="fit" style:zoom={backZoom}>
					<header>
						<h1>{script.name}</h1>
					</header>
					<ScriptSheet
						characters={characters.filter(ruleCharacter)}
						{jinxes}
						density="normal"
						flat
					/>
				</div>
			</section>
		{:else if settings.back === 'night'}
			<section class="page back" bind:this={back} data-back="night">
				<div class="fit" style:zoom={backZoom}>
					<!-- Title and player counts share the top, so both nights fit below them. -->
					<header class="back-head">
						<h1>{script.name}</h1>
						<div class="counts">
							<h2>{t('player.breakdown')}</h2>
							<SetupTable />
						</div>
					</header>
					<PlayerNightOrder {nights} flat />
				</div>
			</section>
		{/if}
	</article>
{/if}

<style>
	/* Paper is light whatever the theme: dark text on white, colours kept for the teams. */
	.print-sheet {
		--surface: var(--print-paper);
		--surface-selected: var(--print-selected);
		--on-surface: var(--print-ink);
		--on-surface-muted: var(--print-muted);
		--heading: var(--print-ink);
		--border: var(--print-rule);
		background: var(--print-paper);
		color: var(--print-ink);
		print-color-adjust: exact;
		-webkit-print-color-adjust: exact;
	}
	/*
	 * One side of paper: the printable height of Letter with 12 mm margins, the shorter of
	 * A4 and Letter, so either paper prints each side on one page.
	 */
	.page {
		height: 255mm;
		overflow: hidden;
	}
	.page + .page {
		break-before: page;
	}
	.front[data-columns='1'] :global(.sheet ul) {
		grid-template-columns: minmax(0, 1fr);
	}
	.front[data-columns='2'] :global(.sheet ul) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
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
		gap: calc(0.4 * var(--u));
	}
	.back :global(.nights .text) {
		font-size: 0.62rem;
		line-height: 1.25;
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
	.with-strips {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: var(--space-2);
		align-items: start;
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
