<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Snippet } from 'svelte';
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import PlayerNightOrder from './PlayerNightOrder.svelte';
	import { playerNight } from './player-script.ts';
	import { playerSettings } from './player-settings.svelte.ts';
	import { sheetStyle } from '#lib/ui/themes/sheet-backgrounds.ts';
	import type { PublicRule } from '#lib/core/sync/public-projection.ts';
	import ScriptCopy from './ScriptCopy.svelte';
	import type { TravellerInPlay } from './travellers-in-play.ts';

	/**
	 * The players' Script and Night tabs as one component: /play shows it, and so does the
	 * board's Script button, so the Storyteller sees exactly what players see (Trevor,
	 * 2026-10-18). Notes are each player's own, so only /play adds that tab.
	 */
	interface Props {
		script: LoadedScript;
		/** Seats at the table; highlights that column of the Players breakdown. */
		players?: number;
		/** Characters on seats, in a game: Travellers and Jinxes start closed when none plays. */
		inPlay?: readonly string[];
		/** Travellers the town knows are in play, with their players. */
		travellers?: readonly TravellerInPlay[];
		/** The game mode and special rules, listed under Jinxes. */
		rules?: readonly PublicRule[];
		/** The Fabled and Loric in play, announced to the town. */
		ruleCharacters?: readonly string[];
		/** The town as the table knows it, from the live room (/play only). */
		grim?: Snippet;
		/** The player's own Notes tab (/play only). */
		notes?: Snippet;
		tab?: string;
	}

	let {
		script,
		players,
		inPlay,
		travellers,
		rules,
		ruleCharacters,
		grim,
		notes,
		tab = $bindable('script')
	}: Props = $props();

	$effect(() => {
		if (!officialData.current) void loadOfficialData();
	});
	const data = $derived(officialData.current);
	const nights = $derived(
		data ? (['first', 'other'] as const).map((n) => playerNight(script, data, n)) : []
	);
	const tabs = $derived([
		{ value: 'script', label: t('player.tab.script'), icon: 'script' as const },
		{ value: 'night', label: t('player.tab.night'), icon: 'night' as const },
		...(grim ? [{ value: 'grim', label: t('player.tab.grim'), icon: 'grimoire' as const }] : []),
		...(notes ? [{ value: 'notes', label: t('player.tab.notes'), icon: 'notes' as const }] : [])
	]);
</script>

<!-- A bar along the bottom with an icon over each tab (Trevor, 2026-10-31: "looks better than
     loose text above the sections"). -->
<Tabs bind:value={tab} label={t('player.title')} {tabs} placement="bottom">
	{#snippet panel(value)}
		<div class="panel">
			<!-- A crash in one tab replaces only that tab. -->
			<ErrorBoundary area="play">
				{#if value === 'script'}
					<div class="bleed">
						<ScriptCopy
							{script}
							{players}
							{inPlay}
							{travellers}
							{rules}
							{ruleCharacters}
							byline={false}
							backgroundChoice={false}
						/>
					</div>
				{:else if value === 'night'}
					<!-- The night order takes the same light background as the script (Trevor,
					     2026-10-23: "Sun and Moon should affect night order as well"). -->
					<div
						class="sheet"
						class:painted={playerSettings.current.sheetBackground !== 'theme'}
						style={sheetStyle(playerSettings.current.sheetBackground)}
						data-testid="night-sheet"
					>
						{#if data}<PlayerNightOrder {nights} />{:else}<p class="muted">
								{t('player.loading')}
							</p>{/if}
					</div>
				{:else if value === 'grim' && grim}
					{@render grim()}
				{:else if value === 'notes' && notes}
					<!-- The Script and Night tabs' inset, so every tab's sections line up (Trevor,
					     2026-10-27: "All these seem to use different indents"). -->
					<div class="inset">{@render notes()}</div>
				{/if}
			</ErrorBoundary>
		</div>
	{/snippet}
</Tabs>

<style>
	/* The sheet's own padding gives the room under the tabs. */
	.panel {
		padding-top: 0;
	}
	/* Padded either way, as ScriptCopy is, so the light background moves nothing. */
	.sheet,
	.inset {
		padding: var(--space-3);
		border-radius: var(--radius-md);
	}
	/* The sheets' padding reaches out into the page's gutter, so their words line up with the
	   tabs' edge rather than sitting inset from it (Trevor, 2026-10-27: "Player view feels
	   slightly constrained"). Every page gutter is at least --space-4, so nothing scrolls
	   sideways. */
	.sheet,
	.inset,
	.bleed {
		margin-inline: calc(-1 * var(--space-3));
		/* With the tabs at the bottom, the sheet's words start where the panel does: its own
		   padding gives way above, as it does at the sides. */
		margin-top: calc(-1 * var(--space-3));
	}
	/* The colours themselves are the chosen background's (themes/sheet-backgrounds.ts), set on the element. */
	.painted {
		background: var(--surface);
		color: var(--on-surface);
		/* Pinned headings in the paper's colour, not the page's. */
		--pin-background: var(--surface);
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
