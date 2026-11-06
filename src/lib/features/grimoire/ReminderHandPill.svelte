<!--
	The token in hand on the Storyteller's board (Trevor, 2026-10-30: a token from the bank or
	the board is selected the same way): its pill over the board's foot, above the bank's
	handle (rendered inside the bank), with its ⋯ and ×; a tap on the token opens its own dialog. While it is held, a tap
	on the board drops it there as a drag let go there does: a seat, a Fabled or Loric,
	"+ New token", the bank (a board token goes back), or an open spot in loose mode.
-->
<script lang="ts">
	import {
		REMINDER_NUMBER_MAX,
		REMINDER_NUMBER_MIN,
		isNumberSymbol,
		numberSymbol,
		symbolNumber,
		type Reminder,
		type ReminderId,
		type SeatId
	} from '#lib/core/model/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { bankView, type BankItem } from './bank-items.ts';
	import BoardReminder from './BoardReminder.svelte';
	import { reminderPlacing } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import type { ReminderDragging } from './reminder-drag.svelte.ts';
	import type { ReminderHand } from './reminder-hand.svelte.ts';
	import ReminderInHand from './ReminderInHand.svelte';
	import { dropOnTap, heldTokenActions, placedTokenActions } from './reminder-in-hand.ts';
	import { onBoard, placedLook } from './reminders.ts';

	import type { ReminderLabel } from '#lib/core/data/index.ts';

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

	/**
	 * A # token's number, picked in the pill (plan M48, Trevor 2026-11-04: any number but 1 took
	 * going into its settings): the bank's # places the one picked, a placed one changes to it.
	 */
	const bankNumber = $derived(hand.held?.kind === 'bank' && !!hand.held.item.number);
	const placedNumber = $derived(
		placed && isNumberSymbol(placed.symbol) ? symbolNumber(placed.symbol) : undefined
	);
	function pickNumber(n: number) {
		if (bankNumber) hand.number = n;
		else if (placed)
			grimoire.run({
				type: 'SetReminderSymbol',
				reminderId: placed.reminderId,
				symbol: numberSymbol(n)
			});
	}

	/**
	 * A counting run stacked in the bank (plan M53, Trevor 2026-11-06: stacked in the bin): the
	 * pill picks which of its tokens goes down, the next one first.
	 */
	const heldRun = $derived(
		hand.held?.kind === 'bank' && (hand.held.item.run?.length ?? 0) > 1 ? hand.held.item : undefined
	);
	function pickRun(label: string) {
		if (heldRun) hand.held = { kind: 'bank', item: { ...heldRun, label: label as ReminderLabel } };
	}

	const actions = $derived.by(() => {
		const held = hand.held;
		const putDown = () => hand.putDown();
		if (held?.kind === 'bank')
			return heldTokenActions(grimoire, held.item, { edit: editToken, putDown });
		if (!placed || !held) return [];
		const edit = () => hand.showAbout(held);
		return placedTokenActions(grimoire, placed, { remove: onRemove, putDown, edit });
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
	>
		{#snippet token()}
			{#if held.kind === 'bank'}<BoardReminder
					{...bankView(held.item, characters)}
					{...bankNumber && { symbol: numberSymbol(hand.number) }}
					{...reminderPlacing(game, held.item, characters)}
				/>{:else if placed}<BoardReminder
					{...placedLook(placed, characters)}
					{...reminderPlacing(game, placed, characters)}
				/>{/if}
		{/snippet}
		{#snippet extra()}
			{@const n = bankNumber ? hand.number : placedNumber}
			{#if n !== undefined}<NumberSelect
					label={t('common.reminderNumber')}
					hideLabel
					value={n}
					min={REMINDER_NUMBER_MIN}
					max={REMINDER_NUMBER_MAX}
					onchange={pickNumber}
					testid="hand-number"
				/>{:else if heldRun}<!-- eslint-disable grim/names-as-badges -- each token shows as its badge (the snippets); its words are the options' accessible names --><Select
					label={t('common.reminderRun')}
					hideLabel
					value={heldRun.label}
					options={(heldRun.run ?? []).map((value) => ({ value, label: value }))}
					onChange={pickRun}
				>
					{#snippet item(option)}<ReminderToken label={option.value as ReminderLabel} />{/snippet}
					{#snippet selected(option)}<ReminderToken
							label={option.value as ReminderLabel}
						/>{/snippet}
				</Select><!-- eslint-enable grim/names-as-badges -->{/if}
		{/snippet}
	</ReminderInHand>
{/if}
