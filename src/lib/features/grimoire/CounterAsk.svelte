<script lang="ts">
	import {
		looseReminders,
		numberSymbol,
		reminderHolder,
		type ReminderInstance
	} from '#lib/core/model/index.ts';
	import { counterMoves, type CounterMove } from '#lib/core/rules/reminders/counters.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import BoardReminder from '#lib/features/board/BoardReminder.svelte';
	import SeatBadge from '#lib/features/board/SeatBadge.svelte';
	import { placedLook } from '#lib/features/board/reminders.ts';
	import { placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * At a new day or night, with Settings' Move counting reminders on Ask (plan M53, Trevor
	 * 2026-11-04): each counting reminder as it will be after the move, beside its seat. Confirm
	 * moves them all (History can undo it); Cancel leaves them. What moves: `counterMoves` in core.
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const at = $derived(grimoire.counterAsk);
	const moves = $derived(at === undefined ? [] : counterMoves(game, characters, at));

	/** A number token wherever it is: on a seat, a Fabled or Loric, or loose. */
	function placed(reminderId: string): ReminderInstance | undefined {
		return [
			...game.seating.flatMap((id) => game.seats[id].reminders),
			...Object.values(game.ruleReminders).flat(),
			...looseReminders(game)
		].find((r) => r.reminderId === reminderId);
	}

	function seatOf(move: CounterMove): string | undefined {
		if (move.kind !== 'number') return move.seatId;
		const holder = reminderHolder(game, move.reminderId);
		return holder && 'seatId' in holder ? holder.seatId : undefined;
	}

	/** An identity key, never shown. */
	const keyOf = (move: CounterMove): string =>
		// eslint-disable-next-line grim/names-as-badges -- an identity key, never shown
		move.kind === 'add' ? `${move.characterId}:${move.label}` : move.reminderId;

	let open = $state(false);
	$effect(() => {
		if (grimoire.counterAsk !== undefined) open = true;
	});
	// Closed any way (Cancel, Escape, the close button): nothing moves.
	$effect(() => {
		if (!open && grimoire.counterAsk !== undefined) grimoire.countersAnswered(false);
	});
</script>

<ConfirmDialog
	bind:open
	title={t('settings.countingReminders')}
	onConfirm={() => grimoire.countersAnswered(true)}
>
	<ul class="rows" data-testid="counter-ask">
		{#each moves as move (keyOf(move))}
			{@const seatId = seatOf(move)}
			{@const token = move.kind === 'number' ? placed(move.reminderId) : undefined}
			<li>
				{#if move.kind === 'number'}
					{#if token}
						<BoardReminder
							{...placedLook(token, characters)}
							symbol={numberSymbol(move.to)}
							alignment={placingAlignment(game, token, characters)}
						/>
					{/if}
				{:else}
					<BoardReminder
						label={move.label}
						character={characters.get(move.characterId)}
						alignment={placingAlignment(game, move.characterId, characters)}
					/>
				{/if}
				{#if seatId !== undefined}
					<span class="seat"><SeatBadge {game} {characters} {seatId} /></span>
				{/if}
			</li>
		{/each}
	</ul>
</ConfirmDialog>

<style>
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.rows li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-block: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	/* The seat's badge a step under the dialog's text, as in Reset Reminders. */
	.seat {
		min-width: 0;
		font-size: 0.85em;
	}
</style>
