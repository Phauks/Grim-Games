<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { sidePane } from '#lib/features/room/side-pane.svelte.ts';
	import BesidePane from '#lib/ui/layout/BesidePane.svelte';
	import { besidePlacement, rootRem, type BesidePlacement } from '#lib/ui/layout/beside.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import StorytellerPane from './StorytellerPane.svelte';

	/**
	 * The board with the Storyteller's pane: the Day, the Night, Game notes and Players (the grim
	 * as the home screen, Trevor 2026-11-16). Beside it where the screen is wide, under it on an
	 * upright tablet, as player Notes are (plan E3), and always shown there, so the board never
	 * changes size; over the screen on a phone, which has room for neither. A spectator's board
	 * has none.
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
		/** The Night tab's contents. */
		night: Snippet;
		children: Snippet;
	}

	let {
		grimoire,
		watching,
		hidden = false,
		beside = $bindable(),
		day,
		night,
		children
	}: Props = $props();

	let width = $state(0);
	let height = $state(0);
	$effect(() => {
		beside = watching ? undefined : besidePlacement(width, height, rootRem());
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

{#snippet pane()}
	<div class="side-pane" inert={hidden}>
		{#if !hidden}<StorytellerPane
				game={grimoire.open}
				run={(command) => grimoire.run(command)}
				{day}
				{night}
			/>{/if}
	</div>
{/snippet}

{#if !watching}
	<Dialog
		bind:open={() => sidePane.open && !beside, (on) => (sidePane.open = on)}
		title={t('room.players.pane')}
		size="full"
		scroll={false}
	>
		<div class="sheet-pane">
			<StorytellerPane
				game={grimoire.open}
				run={(command) => grimoire.run(command)}
				{day}
				{night}
			/>
		</div>
	</Dialog>
{/if}

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
</style>
