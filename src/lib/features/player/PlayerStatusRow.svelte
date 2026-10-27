<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { PublicGameState } from '#lib/core/sync/public-projection.ts';
	import { dayTimers, parsePlayersPhase } from '#lib/core/rules/index.ts';
	import PlayersDayStatus from '#lib/features/day/PlayersDayStatus.svelte';

	/**
	 * The row over the player screen's tabs: everything the table's public state shows there,
	 * such as where the game is up to and the day timer (Trevor, 2026-10-26). A phone feeds it
	 * its room's copy; the board's Script and the grim cover's Player view feed it the state
	 * the room would get (`tableState`), so whatever is added here shows on both
	 * (Trevor, 2026-10-27: "Design it so that these additions move in automatically"). What
	 * only a phone in a room has (its own status, character, Rate) comes in `before`/`after`.
	 */
	interface Props {
		/** The game's public state as players' phones get it. */
		table?: PublicGameState;
		/** The game is over: where it was up to no longer shows. */
		ended?: boolean;
		before?: Snippet;
		after?: Snippet;
	}

	let { table, ended = false, before, after }: Props = $props();

	const phase = $derived(ended ? undefined : parsePlayersPhase(table?.now));
	const timer = $derived(ended ? undefined : dayTimers.parsePublicTimer(table?.timer));
</script>

{#if before || after || phase}
	<div class="status-row" data-testid="player-status-row">
		{@render before?.()}
		<!-- Where the game is up to, with the day's timer; it shares the row's height, so
		     nothing below moves. -->
		{#if phase}<PlayersDayStatus {phase} {timer} seats={table?.seats ?? []} wide />{/if}
		{@render after?.()}
	</div>
{/if}

<style>
	.status-row {
		display: flex;
		align-items: stretch;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	/* The game's status takes the rest of the row (Trevor, 2026-10-27: "the game status bar
	   should then take up the entire horizontal of that line area"). */
	.status-row > :global([data-testid='players-status']) {
		flex: 1;
	}
</style>
