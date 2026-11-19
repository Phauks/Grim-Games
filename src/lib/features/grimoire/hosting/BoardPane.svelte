<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { sidePane } from '#lib/features/room/side-pane.svelte.ts';
	import BesidePane from '#lib/ui/layout/BesidePane.svelte';
	import { besidePlacement, rootRem, type BesidePlacement } from '#lib/ui/layout/beside.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import StorytellerPane from './StorytellerPane.svelte';
	import BluffsSheet from '#lib/features/bluffs/BluffsSheet.svelte';
	import SoundboardPanel from '#lib/features/sound/SoundboardPanel.svelte';
	import HistoryDialog from '#lib/features/grimoire/HistoryDialog.svelte';
	import DayCounts from '#lib/features/day/DayCounts.svelte';
	import { LiveDay } from '#lib/features/day/live-day.svelte.ts';

	/**
	 * The board with the Storyteller's pane: the Day, the Night, Game notes and Players (the grim
	 * as the home screen, Trevor 2026-11-16). Beside it where the screen is wide, under it on an
	 * upright tablet, as player Notes are (plan E3), and always shown there, so the board never
	 * changes size; over the screen on a phone, which has room for neither. A spectator's board
	 * has the same pane, to read (Trevor, 2026-11-18).
	 */
	interface Props {
		grimoire: Grimoire;
		watching: boolean;
		/** Showing the Grimoire to a player: the pane keeps its place, empty. */
		hidden?: boolean;
		/** Where the pane shows beside the board, if it can (none on a phone). */
		beside?: BesidePlacement;
		/** The Day tab's contents. */
		day: Snippet;
		/** The Night tab's contents; none for a spectator. */
		night?: Snippet;
		/** The game's mode gives the Demon bluffs, so the pane has a Bluffs view. */
		bluffs?: boolean;
		/** More's Seats and Session, from the board; a spectator has no Seats. */
		seats?: Snippet;
		session: Snippet;
		children: Snippet;
	}

	let {
		grimoire,
		watching,
		hidden = false,
		beside = $bindable(),
		day,
		night,
		bluffs = false,
		seats,
		session,
		children
	}: Props = $props();

	let width = $state(0);
	let height = $state(0);
	$effect(() => {
		beside = besidePlacement(width, height, rootRem());
	});
	$effect(() => {
		sidePane.beside = !!beside;
	});
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

<!-- The board's height, the screen's within its safe areas, unless it shares it (--panel-room). -->
<div class="board-pane">
	<BesidePane
		placement={beside}
		label={t('room.players.pane')}
		room="var(--board-room)"
		solid
		pane={beside ? pane : undefined}>{@render children()}</BesidePane
	>
</div>

{#snippet bluffsView()}
	<!-- Shown again, it starts on the sets: leaving the view drops an edit left open (Trevor,
	     2026-11-19). -->
	<BluffsSheet
		inline
		open={sidePane.view === 'bluffs' && (!!beside || sidePane.open)}
		readOnly={watching}
		game={grimoire.game}
		characters={grimoire.open.characters}
		dispatch={(command) => grimoire.open.run(command)}
	/>
{/snippet}
{#snippet soundsView()}<SoundboardPanel />{/snippet}
{#snippet paneBody()}
	<StorytellerPane
		game={grimoire.open}
		run={(command) => grimoire.run(command)}
		{day}
		{night}
		{watching}
		bluffs={bluffs ? bluffsView : undefined}
		{seats}
		sounds={watching ? undefined : soundsView}
		history={historyView}
		{session}
	/>
{/snippet}
{#snippet historyView()}<HistoryDialog inline {grimoire} />{/snippet}

<!-- On a phone the Day's counts sit small in the sheet's header, so the Day gains a row (Trevor,
     2026-11-19, "B Header, compact"), in the title's place, from the left ("You can remove "game"
     in header and only have the pills, left aligned"). The title is still read out. -->
{#snippet dayCounts()}<DayCounts game={new LiveDay(grimoire.open)} compact />{/snippet}

{#snippet pane()}
	<div class="side-pane" data-at={beside} inert={hidden}>
		{#if !hidden}{@render paneBody()}{/if}
	</div>
{/snippet}

<Dialog
	bind:open={() => sidePane.open && !beside, (on) => (sidePane.open = on)}
	title={t('room.players.pane')}
	size="full"
	scroll={false}
	headActions={sidePane.view === 'day' ? dayCounts : undefined}
	titleHidden={sidePane.view === 'day'}
>
	<div class="sheet-pane">
		{@render paneBody()}
	</div>
</Dialog>

<style>
	/* On a phone each tab's scroll box reaches into the sheet's side padding, so a band reaching
	   out (Collapsible) is not cut off at the scroll box's edge. */
	.sheet-pane {
		--pane-gutter: var(--space-2);
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		height: 100%;
		margin-inline: calc(-1 * var(--pane-gutter));
	}
	.board-pane {
		--board-room: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
	}
	/* The pane's own inset from the screen's edge, as the toolbar's; Players has no sheet edge
	   to reach out to. The inset is inside each tab's scroll box (--pane-gutter), so its
	   scrollbar sits on the screen's edge and a band reaching into the gutter is not cut off
	   (Trevor, 2026-11-17). */
	.side-pane {
		box-sizing: border-box;
		height: 100%;
		padding: var(--menu-inset) 0 0;
		/* Room for a band to reach out (Collapsible) and still keep the inset. */
		--pane-gutter: calc(var(--menu-inset) + var(--space-2));
		--players-bleed: 0rem;
	}
	/* Beside the board its own inset is the gutter's, the same on both sides, not the beside
	   pane's too; under the board it keeps the screen's width. */
	.side-pane[data-at='side'] {
		margin-inline-start: calc(-1 * var(--space-3));
	}
</style>
