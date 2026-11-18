<!--
	A player to pick for a night step beside the board (board-pick.svelte.ts): the same pill
	as a reminder in hand (Trevor, 2026-11-17: "same way we show valid picks for a reminder
	token"), its token the picking character's with what is picked, and × to stop. While it
	waits, a tap on a seat picks that player; a tap anywhere else on the board does nothing.
-->
<script lang="ts">
	import type { CharacterLookup } from '#lib/core/model/index.ts';
	import type { ReminderLabel } from '#lib/core/data/index.ts';
	import BoardReminder from '#lib/features/board/BoardReminder.svelte';
	import ReminderInHand from '#lib/features/board/ReminderInHand.svelte';
	import { boardPick } from '#lib/features/grimoire/seats/board-pick.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { dropOnTap } from './reminder-in-hand.ts';

	interface Props {
		characters: CharacterLookup;
		board: HTMLElement | undefined;
		/** A reminder in hand comes first: its taps are its own. */
		holding: boolean;
	}

	let { characters, board, holding }: Props = $props();
	const pick = $derived(holding ? undefined : boardPick.current);

	$effect(() => {
		const el = board;
		if (!el || !pick) return;
		const keep = (target: Element) => !!target.closest('[data-testid="reminder-in-hand"]');
		return dropOnTap(el, keep, (x, y) => {
			const seat = document
				.elementsFromPoint(x, y)
				.find((e) => e instanceof HTMLElement && e.dataset.seatId);
			const seatId = seat instanceof HTMLElement ? seat.dataset.seatId : undefined;
			if (seatId) boardPick.answer(seatId);
		});
	});
</script>

{#if pick}
	<ReminderInHand onPutDown={() => boardPick.cancel()} putDownLabel={t('common.cancel')}>
		{#snippet token()}<BoardReminder
				label={pick.label as ReminderLabel}
				character={pick.characterId ? characters.get(pick.characterId) : undefined}
			/>{/snippet}
	</ReminderInHand>
{/if}
