<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import DayPanel from '#lib/features/day/DayPanel.svelte';
	import { LiveDay } from '#lib/features/day/live-day.svelte.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';

	/**
	 * The day in the Storyteller's pane, beside the board (Trevor, 2026-11-16: the grim as the
	 * home screen): the board has the timer and Execution, so the day has neither.
	 */
	interface Props {
		game: OpenGame;
		town: { can: boolean; called: boolean };
		onExecute?: (seatId: SeatId, cause: CharacterId) => void;
		onSavant?: (seatId: SeatId) => void;
	}

	let { game, town, onExecute, onSavant }: Props = $props();
	const day = $derived(new LiveDay(game));
</script>

<div class="day-pane">
	<DayPanel
		game={day}
		assistance={preferences.current.assistance}
		timer={false}
		{town}
		{onExecute}
		{onSavant}
	/>
</div>

<style>
	.day-pane {
		/* The day's two columns (L45) follow the pane's width, not the window's. */
		container: day / inline-size;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
</style>
