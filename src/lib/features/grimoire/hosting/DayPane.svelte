<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import DayPanel from '#lib/features/day/DayPanel.svelte';
	import { LiveDay } from '#lib/features/day/live-day.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { provideDayTokens } from '#lib/features/day/day-tokens.ts';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import DayTokenRows from './DayTokenRows.svelte';
	import { reminderCopies } from '#lib/features/board/reminders.ts';
	import type { PaneTokens } from './pane-tokens.ts';

	/**
	 * The day in the Storyteller's pane, beside the board (Trevor, 2026-11-16: the grim as the
	 * home screen): the board has the timer and Execution, so the day has neither.
	 */
	interface Props {
		grimoire: Grimoire;
		/** What a day row's reminder tokens do on the board. */
		tokens: PaneTokens;
		town: { can: boolean; called: boolean };
		onExecute?: (seatId: SeatId, cause: CharacterId) => void;
		onSavant?: (seatId: SeatId) => void;
	}

	let { grimoire, tokens, town, onExecute, onSavant }: Props = $props();
	const day = $derived(new LiveDay(grimoire.open));
	provideDayTokens(rows);
	const total = $derived(
		reminderCopies(grimoire.game, grimoire.open.characters, grimoire.copies, grimoire.bankCopies)
	);
</script>

{#snippet rows(characterId: CharacterId)}<DayTokenRows
		{grimoire}
		{characterId}
		{total}
		onPlace={(token, at) => tokens.place(token, at)}
		onDrag={tokens.drag}
	/>{/snippet}

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
