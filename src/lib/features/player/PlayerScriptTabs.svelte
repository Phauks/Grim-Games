<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Snippet } from 'svelte';
	import type { LoadedScript, NumericNightOrder } from '#lib/core/data/index.ts';
	import {
		loadNumericNightOrder,
		loadOfficialData,
		officialData
	} from '#lib/features/characters/game-data.svelte.ts';
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

	let numeric = $state<NumericNightOrder>();
	$effect(() => {
		if (!officialData.current) void loadOfficialData();
		// Without the provisional numbers TPI's own order is used.
		loadNumericNightOrder().then(
			(n) => (numeric = n),
			() => undefined
		);
	});
	const data = $derived(officialData.current);
	const nights = $derived(
		data ? (['first', 'other'] as const).map((n) => playerNight(script, data, n, numeric)) : []
	);
	const tabs = $derived([
		{ value: 'script', label: t('player.tab.script') },
		{ value: 'night', label: t('player.tab.night') },
		...(grim ? [{ value: 'grim', label: t('player.tab.grim') }] : []),
		...(notes ? [{ value: 'notes', label: t('player.tab.notes') }] : [])
	]);
</script>

<Tabs bind:value={tab} label={t('player.title')} {tabs}>
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
		/* From the tabs' line to the first heading is the same as the side margin (Trevor,
		   2026-10-28: "probably just match side distance"): the tab panel's own top padding
		   and the sheet's give way to it. A host whose side margin isn't the page gutter
		   (the board's Script dialog) sets --player-side. */
		margin-top: calc(var(--player-side, var(--page-gutter)) - var(--space-4) - var(--space-3));
	}
	/* The colours themselves are the chosen background's (themes/sheet-backgrounds.ts), set on the element. */
	.painted {
		background: var(--surface);
		color: var(--on-surface);
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
