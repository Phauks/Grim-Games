<script lang="ts">
	import DefaultBackgroundRow from './DefaultBackgroundRow.svelte';
	import BoardBackgroundRow from '#lib/features/board/BoardBackgroundRow.svelte';
	import { boardBackground } from '#lib/features/board/board-background.svelte.ts';
	import { defaultBackground } from '#lib/features/board/default-background.svelte.ts';
	import { animationsOn } from '#lib/ui/animations.svelte.ts';
	import MovingMotionRows from '#lib/features/board/moving/MovingMotionRows.svelte';

	/**
	 * The board's background and how a moving one moves: Theme > Background, in the game
	 * pane and the player's Theme sheet. With a board open, its own background too (the board thread, Trevor
	 * 2026-10-18); otherwise the default for new games.
	 */
	const shown = $derived(boardBackground.context?.current ?? defaultBackground.current);
</script>

{#if boardBackground.context}<BoardBackgroundRow
		board={boardBackground.context}
	/>{:else}<DefaultBackgroundRow />{/if}
<MovingMotionRows enabled={shown?.kind === 'moving' && animationsOn()} />
