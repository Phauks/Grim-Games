<script lang="ts">
	import type { ReminderId, SeatId } from '#lib/core/model/index.ts';
	import { setupReminders } from '#lib/core/rules/index.ts';
	import CharacterSummary from '#lib/features/characters/CharacterSummary.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import ReminderMoreButton from './ReminderMoreButton.svelte';
	import ReminderNoteField from './ReminderNoteField.svelte';
	import ReminderOrigin from './ReminderOrigin.svelte';
	import { isGeneric, placedLook } from './reminders.ts';

	/** One reminder's own dialog over the seat sheet: whose it is, move it, or take it off. */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
		seatId: SeatId | undefined;
		reminderId: ReminderId | undefined;
		/** Move to another seat: the sheet asks which. */
		onMove: () => void;
		/** Return to the reminder bank, or remove it: the sheet confirms. */
		onReturn: () => void;
	}

	let { open = $bindable(), grimoire, seatId, reminderId, onMove, onReturn }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const seat = $derived(seatId === undefined ? undefined : game.seats[seatId]);
	const movingReminder = $derived(seat?.reminders.find((r) => r.reminderId === reminderId));
	/** A setup reminder can go back to the Setup reminders tray (Trevor, 2026-10-16). */
	const fromSetup = $derived.by(() => {
		const r = movingReminder;
		if (!r || !seat || !seatId) return false;
		// Suggested at setup once this token is off the board again.
		const without = {
			...game,
			seats: {
				...game.seats,
				[seatId]: { ...seat, reminders: seat.reminders.filter((x) => x !== r) }
			}
		};
		return setupReminders(without, characters).some(
			(s) => s.characterId === r.characterId && s.label === r.label
		);
	});

	/** Runs a menu action after closing the menu. */
	function fromMenu(action: () => void) {
		open = false;
		action();
	}
</script>

<Dialog bind:open title="Reminder">
	<!-- The token itself, as on the board (Trevor, 2026-10-30). -->
	{#snippet heading()}
		{#if movingReminder}<BoardReminder
				{...placedLook(movingReminder, characters)}
				alignment={placingAlignment(game, movingReminder, characters)}
			/>{:else}Reminder{/if}
	{/snippet}
	{#snippet subtitle()}
		{#if movingReminder && seatId}From <ReminderOrigin
				{game}
				{characters}
				characterId={movingReminder.characterId}
				on={seatId}
			/>{/if}
	{/snippet}
	<!-- Whose ability it comes from, first, so an unfamiliar reminder makes sense (Trevor,
	     2026-10-17); "From" above already names it (Trevor, 2026-10-18). -->
	{#if movingReminder && isGeneric(movingReminder)}
		<ReminderNoteField {grimoire} reminder={movingReminder} />
	{/if}
	{#if movingReminder}
		{@const source = characters.get(movingReminder.characterId)}
		{#if source}<CharacterSummary character={source} reminders={false} />{/if}
	{/if}
	<div class="menu">
		<Button variant="quiet" icon="move" onclick={() => fromMenu(onMove)}>
			Move to another seat
		</Button>
		<Button
			variant="quiet"
			icon="reminder"
			disabled={!fromSetup}
			onclick={() => fromMenu(onReturn)}
		>
			Return to reminder bank
		</Button>
	</div>
	{#snippet headActions()}
		<ReminderMoreButton {grimoire} {reminderId} onDone={() => (open = false)} />
		<DeleteButton label="Remove reminder" onclick={() => fromMenu(onReturn)} />
	{/snippet}
</Dialog>

<style>
	.menu {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
</style>
