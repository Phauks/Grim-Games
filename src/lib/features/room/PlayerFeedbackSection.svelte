<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { seatsInOrder, type SeatId } from '#lib/core/model/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import FeedbackSummary from './FeedbackSummary.svelte';
	import { gameFeedback } from './game-feedback.svelte.ts';

	/**
	 * Players' feedback on one game, as its own section (Trevor, 2026-11-18, "B own section"):
	 * kept in place but closed until the game is over, so nothing moves when it ends (Trevor,
	 * 2026-11-16: "keeps review separate from the game"). On its own so it can move as the pane
	 * is reorganised.
	 */
	interface Props {
		game: OpenGame;
		/** The game is over, so players' feedback can be read. */
		ended?: boolean;
	}

	let { game, ended = false }: Props = $props();

	// Saved with the game on this device (Trevor, 2026-10-25).
	const feedback = $derived(ended ? gameFeedback.read(game.game.gameId) : []);
	const seats = $derived(seatsInOrder(game.game));
	const seatOf = (seatId: string) =>
		seats.findIndex((s) => s.seatId === (seatId as SeatId)) + 1 || undefined;
</script>

<Collapsible
	title={t('room.feedback.view')}
	storageKey="players-feedback"
	band="fill"
	pinned={false}
	disabled={!ended}
	count={feedback.length}
	empty={feedback.length === 0}
>
	<FeedbackSummary entries={feedback} {seatOf} />
</Collapsible>
