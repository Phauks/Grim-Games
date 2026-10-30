<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { scriptLogo, type LoadedScript } from '#lib/core/data/index.ts';
	import type { PublicRule } from '#lib/core/sync/public-projection.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import SetupTable from '#lib/features/setup/SetupTable.svelte';
	import PlayerNightOrder from './PlayerNightOrder.svelte';
	import { playerJinxes, playerNight, sheetCharacters } from './player-script.ts';
	import NightStrip from './NightStrip.svelte';
	import ScriptByline from './ScriptByline.svelte';
	import ScriptSheet from './ScriptSheet.svelte';
	import { tick, type Snippet } from 'svelte';
	import {
		PAPER_MM,
		PRINT_DEFAULTS,
		type PrintSettings,
		type SheetDensity
	} from './player-settings.svelte.ts';

	/**
	 * The printed script: the sheet on the front, and a back of the reader's choosing (Trevor
	 * approved, 2026-10-16; a switch per item, 2026-10-29). Drawn on the device, so printing
	 * needs no server.
	 *
	 * Each side is one page (Trevor, 2026-10-18) of the chosen paper less its margins.
	 * `fit()` tries one column, then two, then denser sheets, then zooms each side to fit.
	 */
	interface Props {
		script: LoadedScript;
		version?: string;
		/** The reader's choices from the Print screen (Trevor, 2026-10-19). */
		settings?: PrintSettings;
		/** The game mode and special rules, when printed from a game. */
		rules?: readonly PublicRule[];
		/**
		 * The Print screen's preview: each side on its paper, margins and all, under its page
		 * number and side (Trevor, 2026-10-29: "better delineation between which page is page 1, 2").
		 */
		preview?: boolean;
	}

	let { script, version, settings = PRINT_DEFAULTS, rules = [], preview = false }: Props = $props();

	$effect(() => {
		if (!officialData.current) void loadOfficialData();
	});
	const data = $derived(officialData.current);
	const characters = $derived(data ? sheetCharacters(script, data) : []);
	const jinxes = $derived(data ? playerJinxes(script, data) : []);
	const ruleCharacter = (c: { type: string }) => c.type === 'fabled' || c.type === 'loric';
	const front = $derived(settings.front);
	const back = $derived(settings.back);
	const frontCharacters = $derived(
		front.ruleCharacters ? characters : characters.filter((c) => !ruleCharacter(c))
	);
	const backCharacters = $derived(back.ruleCharacters ? characters.filter(ruleCharacter) : []);
	const backJinxes = $derived(back.jinxes && jinxes.length > 0);
	const backRules = $derived(back.rules ? rules : []);
	const logo = $derived(front.logo ? scriptLogo(script) : undefined);
	const nights = $derived(
		data ? (['first', 'other'] as const).map((n) => playerNight(script, data, n)) : []
	);
	/** The printable area: the paper less a margin each side. */
	const paper = $derived(PAPER_MM[settings.pageSize]);
	const area = $derived(paper.map((side) => Math.max(side - 2 * settings.margin, 50)));

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
	let frontPage = $state<HTMLElement>();
	let backPage = $state<HTMLElement>();
	const fits = (page: HTMLElement) => page.scrollHeight <= page.clientHeight + 1;

	/**
	 * The largest zoom, up to `max`, at which a side fits its page. A search, since text
	 * rewraps as it shrinks: a smaller zoom gives the lines more room. It starts from the
	 * overflow's own ratio, which always fits (rewrapped lines only get shorter), so a few
	 * steps settle it where a search from nothing took eight (Trevor, 2026-10-29: opening lagged).
	 */
	async function zoomToFit(page: HTMLElement, zoom: (z: number) => void, max: number) {
		const fitsAt = async (z: number) => {
			zoom(z);
			await tick();
			return fits(page);
		};
		if (await fitsAt(max)) return;
		let lo = Math.max(0.2, (max * page.clientHeight) / page.scrollHeight);
		let hi = max;
		if (!(await fitsAt(lo))) {
			hi = lo;
			lo = 0.2;
		}
		// Within 2%: each step lays the whole side out again, the slow part on a phone.
		for (let i = 0; i < 3 && hi - lo > 0.02; i++) {
			const mid = (lo + hi) / 2;
			if (await fitsAt(mid)) lo = mid;
			else hi = mid;
		}
		zoom(lo);
		await tick();
	}

	/** Lays both sides out to one page each; call once the sheet and its icons have loaded. */
	export async function fit() {
		await loadOfficialData().catch(() => undefined);
		await tick();
		if (frontPage) {
			frontZoom = 1;
			// A fixed choice keeps only the layouts with it; Automatic tries them all.
			const fixedColumns = front.columns === 'auto' ? undefined : front.columns === 'one' ? 1 : 2;
			const fixedDensity = front.density === 'auto' ? undefined : front.density;
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
				if (fits(frontPage)) break;
			}
			// Then as large as fits: a sheet that fits with room to spare grows to fill the page.
			await zoomToFit(frontPage, (z) => (frontZoom = z), 1.3);
		}
		// The back's type starts small, so a short back grows to fill its page.
		if (backPage) await zoomToFit(backPage, (z) => (backZoom = z), 1.5);
	}
</script>

{#snippet side(number: number, name: string, page: Snippet)}
	{#if preview}
		<figure class="paper-side" data-testid="print-page" data-page={number}>
			<figcaption><span class="number">{number}</span>{name}</figcaption>
			<div class="paper">{@render page()}</div>
		</figure>
	{:else}
		{@render page()}
	{/if}
{/snippet}

{#if data}
	<article
		class="print-sheet"
		data-testid="print-sheet"
		data-friendly={settings.printerFriendly || undefined}
		data-underlines={settings.underlines || undefined}
		style:--page-width="{area[0]}mm"
		style:--page-height="{area[1]}mm"
		style:--paper-width="{paper[0]}mm"
		style:--paper-height="{paper[1]}mm"
		style:--paper-margin="{settings.margin}mm"
	>
		{#snippet frontPageSnippet()}
			<section class="page front" bind:this={frontPage} data-columns={columns}>
				<!-- Night order down both sides, first night left (Ravenswood's idea, Trevor 2026-10-19). -->
				<div
					class="fit"
					class:with-strips={front.nightStrips}
					style:zoom={frontZoom}
					style:--character-ring-scale={front.iconScale}
				>
					{#if front.nightStrips && nights[0]}<NightStrip night={nights[0]} />{/if}
					<div class="main">
						<header class="front-head">
							{#if logo}<ScriptLogo src={logo} class="print-logo" />{/if}
							<div>
								<h1>{script.name}</h1>
								<ScriptByline author={script.meta.author} {version} />
							</div>
						</header>
						<ScriptSheet
							characters={frontCharacters}
							{jinxes}
							showJinxes={front.jinxes}
							rules={front.rules ? rules : []}
							{density}
							flat
						/>
					</div>
					{#if front.nightStrips && nights[1]}<NightStrip night={nights[1]} />{/if}
				</div>
			</section>
		{/snippet}
		{@render side(1, t('player.printFront'), frontPageSnippet)}
		{#if back.enabled}
			{#snippet backPageSnippet()}
				<section class="page back" bind:this={backPage}>
					<div class="fit" style:zoom={backZoom} style:--character-ring-scale={back.iconScale}>
						<!-- Title and player counts share the top, so both nights fit below them. -->
						<header class="back-head">
							<h1>{script.name}</h1>
							{#if back.counts}
								<div class="counts">
									<h2>{t('player.breakdown')}</h2>
									<SetupTable />
								</div>
							{/if}
						</header>
						{#if back.night}<PlayerNightOrder {nights} flat />{/if}
						{#if backCharacters.length || backJinxes || backRules.length}
							<ScriptSheet
								characters={backCharacters}
								{jinxes}
								showJinxes={backJinxes}
								rules={backRules}
								density="normal"
								flat
							/>
						{/if}
					</div>
				</section>
			{/snippet}
			{@render side(2, t('player.printBack'), backPageSnippet)}
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
	/* One side of paper: the chosen paper's printable area, its margins being the page's. */
	.page {
		width: var(--page-width);
		height: var(--page-height);
		overflow: hidden;
	}
	.page ~ .page {
		break-before: page;
	}
	/* The preview: each side on its whole paper, under "1 Front" and "2 Back". */
	.paper-side {
		display: grid;
		gap: var(--space-2);
		margin: 0 0 var(--space-5);
	}
	/* Ink on paper in any theme: a dark label with the page number in a light circle. */
	figcaption {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		justify-self: start;
		padding: var(--space-1) var(--space-4) var(--space-1) var(--space-1);
		border-radius: var(--radius-full);
		background: var(--print-ink);
		color: var(--print-paper);
		font-family: var(--font-control);
		font-size: 2rem;
	}
	.number {
		display: inline-grid;
		place-items: center;
		width: 1.4em;
		height: 1.4em;
		border-radius: var(--radius-full);
		background: var(--print-paper);
		color: var(--print-ink);
		font-variant-numeric: tabular-nums;
	}
	/* The preview's sheet sits on the dialog, not on paper: only each page is paper. */
	.print-sheet:has(.paper-side) {
		background: none;
	}
	.paper {
		box-sizing: content-box;
		width: var(--page-width);
		height: var(--page-height);
		padding: var(--paper-margin);
		background: var(--print-paper);
		box-shadow: 0 0 0 1px var(--print-rule);
	}
	/* The margins, faintly, so the paper's edge reads apart from the sheet's. */
	.paper .page {
		outline: 1px dashed var(--print-rule);
	}
	/* Ink saver (Trevor, 2026-10-29): the team colours as outlines, not fills. */
	.print-sheet[data-friendly] :global(.band) {
		background: none;
		color: var(--team);
		box-shadow: inset 0 0 0 1px var(--team);
	}
	.print-sheet[data-friendly] :global(.ring) {
		background: var(--print-paper);
	}
	/* Paper can't be tapped: the rules terms' "tap me" underline goes (Trevor, 2026-10-29). */
	.print-sheet:not([data-underlines]) :global(.glossary-term) {
		text-decoration: none;
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
	.back :global(.nights .icon) {
		width: calc(3 * var(--u) * var(--character-ring-scale, 1));
		height: calc(3 * var(--u) * var(--character-ring-scale, 1));
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
	.front-head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.front-head :global(.print-logo) {
		width: 5rem;
		height: 3.2rem;
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
