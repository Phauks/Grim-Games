<script lang="ts">
	import { seatNumber, type Game, type SeatId } from '#lib/core/model/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import FeedbackSummary from '#lib/features/room/FeedbackSummary.svelte';
	import { gameFeedback } from '#lib/features/room/game-feedback.svelte.ts';

	/**
	 * Players' feedback on a finished game, for the Storyteller (Trevor, 2026-10-25), read from
	 * this device, where the room's feedback is saved with the game.
	 */
	interface Props {
		open: boolean;
		game: Game;
	}

	let { open = $bindable(), game }: Props = $props();

	const entries = $derived(open ? gameFeedback.read(game.gameId) : []);
</script>

<BottomSheet bind:open title={t('room.feedback.view')}>
	<FeedbackSummary {entries} seatOf={(seatId) => seatNumber(game, seatId as SeatId)} />
</BottomSheet>
