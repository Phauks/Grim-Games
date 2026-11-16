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
	 * The board with the Storyteller's Game notes and Players (plan M86, Trevor 2026-11-15:
	 * "I really like seeing the notes right next to the game grim"): beside it where the screen
	 * is wide, under it on an upright tablet, as player Notes are (plan E3); over the screen on
	 * a phone, which has room for neither. A spectator's board has none.
	 */
	interface Props {
		grimoire: Grimoire;
		watching: boolean;
		/** Where the pane shows beside the board, if it can (none on a phone). */
		beside?: BesidePlacement;
		children: Snippet;
		/** Fills the box it is in, not the screen: the final grimoire's dialog (2026-11-15). */
		fill?: boolean;
	}

	let { grimoire, watching, beside = $bindable(), fill = false, children }: Props = $props();

	let width = $state(0);
	let height = $state(0);
	$effect(() => {
		beside = watching ? undefined : besidePlacement(width, height, rootRem());
	});
	const shown = $derived(!watching && sidePane.open);
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

<!-- The board's height, the screen's within its safe areas, unless it shares it (--panel-room). -->
<div class="board-pane" class:fill>
	<BesidePane
		placement={shown ? beside : undefined}
		label={t('room.players.pane')}
		room="var(--board-room)"
		pane={shown && beside ? pane : undefined}>{@render children()}</BesidePane
	>
</div>

{#snippet pane()}
	<div class="side-pane">
		<StorytellerPane game={grimoire.open} run={(command) => grimoire.run(command)} />
	</div>
{/snippet}

{#if !watching}
	<Dialog
		bind:open={() => sidePane.open && !beside, (on) => (sidePane.open = on)}
		title={t('room.players.pane')}
		size="full"
		scroll={false}
	>
		<StorytellerPane game={grimoire.open} run={(command) => grimoire.run(command)} />
	</Dialog>
{/if}

<style>
	.board-pane {
		--board-room: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
	}
	.board-pane.fill,
	.board-pane.fill > :global(.beside),
	.board-pane.fill > :global(.beside > .main) {
		--board-room: 100%;
		height: 100%;
	}
	/* The pane's own inset from the screen's edge, as the toolbar's; Players has no sheet edge
	   to reach out to. */
	.side-pane {
		box-sizing: border-box;
		height: 100%;
		padding: var(--menu-inset) var(--menu-inset) 0;
		--players-bleed: 0rem;
	}
</style>
