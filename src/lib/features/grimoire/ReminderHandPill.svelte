<!--
	The token in hand on the Storyteller's board (Trevor, 2026-10-30: a token from the bank or
	the board is selected the same way): its pill over the board's foot, above the bank's
	handle (rendered inside the bank), with its ⋯ and ×; a tap on the token opens its own dialog. While it is held, a tap
	on the board drops it there as a drag let go there does: a seat, a Fabled or Loric,
	"+ New token", the bank (a board token goes back), or an open spot in loose mode.
-->
<script lang="ts">
	import type { Reminder, ReminderId, SeatId } from '#lib/core/model/index.ts';
	import type { BankItem } from './bank-items.ts';
	import BoardReminder from './BoardReminder.svelte';
	import { placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import type { ReminderDragging } from './reminder-drag.svelte.ts';
	import type { ReminderHand } from './reminder-hand.svelte.ts';
	import ReminderInHand from './ReminderInHand.svelte';
	import { dropOnTap, heldTokenActions, placedTokenActions } from './reminder-in-hand.ts';
	import { isGeneric, onBoard, placedLook } from './reminders.ts';

	interface Props {
		grimoire: Grimoire;
		hand: ReminderHand;
		board: HTMLElement | undefined;
		remDrag: ReminderDragging;
		/** Drops a bank token at a client point (ReminderBank). */
		dropBank: (item: BankItem, x: number, y: number) => void;
		/** Opens an ∞ token's editor (ReminderBank). */
		editToken: (tokenId: string) => void;
		/** Takes a board token off the board (ReminderMoveConfirm). */
		onRemove: (reminderId: ReminderId) => void;
		/** Marks the seats for a board token in hand. */
		onHints: (hints: { seats: SeatId[]; reminder?: Reminder }) => void;
	}

	let { grimoire, hand, board, remDrag, dropBank, editToken, onRemove, onHints }: Props = $props();

	const characters = $derived(grimoire.open.characters);
	const game = $derived(grimoire.game);
	const placed = $derived.by(() => {
		const held = hand.held;
		if (held?.kind !== 'placed') return undefined;
		return onBoard(game).find((r) => r.reminderId === held.reminderId);
	});
	// A board token gone from the board (removed, undone, moved by a drag) is let go.
	$effect(() => {
		if (hand.held?.kind === 'placed' && !placed) hand.putDown();
	});
	// Its seats marked as while it is dragged.
	$effect(() => {
		if (hand.held?.kind !== 'placed') return;
		onHints({ seats: [], reminder: placed });
		return () => onHints({ seats: [] });
	});

	const actions = $derived.by(() => {
		const held = hand.held;
		const putDown = () => hand.putDown();
		if (held?.kind === 'bank')
			return heldTokenActions(grimoire, held.item, { edit: editToken, putDown });
		return placed ? placedTokenActions(grimoire, placed, { remove: onRemove, putDown }) : [];
	});

	$effect(() => {
		const el = board;
		const held = hand.held;
		if (!el || !held) return;
		// A bank token's taps on the bank stay the bank's; a board token's drop it there.
		const keep = (target: Element) =>
			!!target.closest('[data-testid="reminder-in-hand"]') ||
			(held.kind === 'bank' && !!target.closest('[data-tray]'));
		return dropOnTap(el, keep, (x, y) => {
			hand.putDown();
			if (held.kind === 'bank') dropBank(held.item, x, y);
			else remDrag.move(held.reminderId, held.from, x, y, true, true);
		});
	});
</script>

{#if hand.held}
	{@const held = hand.held}
	<ReminderInHand
		{actions}
		bind:menuOpen={hand.menuOpen}
		onAbout={() => hand.showAbout(held)}
		onPutDown={() => hand.putDown()}
		--hand-bottom="calc(100% + var(--tap-target) / 2 + var(--space-2))"
	>
		{#snippet token()}
			{#if held.kind === 'bank'}<BoardReminder
					label={held.item.label}
					character={characters.get(held.item.characterId)}
					alignment={placingAlignment(game, held.item, characters)}
					infinite={isGeneric(held.item)}
					symbol={held.item.token?.symbol}
					symbolColour={held.item.token?.symbolColour}
					symbolFill={held.item.token?.symbolFill}
				/>{:else if placed}<BoardReminder
					{...placedLook(placed, characters)}
					alignment={placingAlignment(game, placed, characters)}
				/>{/if}
		{/snippet}
	</ReminderInHand>
{/if}
