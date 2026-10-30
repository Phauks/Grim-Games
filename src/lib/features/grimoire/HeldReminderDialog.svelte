<script lang="ts">
	import {
		looseReminders,
		reminderHolder,
		type ReminderId,
		type SeatId
	} from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterSummary from '#lib/features/characters/CharacterSummary.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import SeatChooser from './SeatChooser.svelte';
	import ReminderMoreButton from './ReminderMoreButton.svelte';
	import { isGeneric, placedLook, tokenLabel } from './reminders.ts';
	import ReminderNoteField from './ReminderNoteField.svelte';

	/**
	 * A reminder that is on no seat: one a Fabled or Loric holds, or one loose on the board
	 * (Trevor, 2026-10-17). Whose ability it comes from first, then where it can go.
	 */
	interface Props {
		grimoire: Grimoire;
		/** Takes it off the board (ReminderMoveConfirm). */
		onRemove: (reminderId: ReminderId) => void;
		/** Puts it on a seat (ReminderMoveConfirm). */
		onMove: (reminderId: ReminderId, toSeatId: SeatId) => void;
	}

	let { grimoire, onRemove, onMove }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	let open = $state(false);
	let seatOpen = $state(false);
	let shown = $state<ReminderId>();

	export function show(reminderId: ReminderId): void {
		shown = reminderId;
		open = true;
	}

	const holder = $derived(shown ? reminderHolder(game, shown) : undefined);
	const reminder = $derived.by(() => {
		if (!shown || !holder) return undefined;
		const held =
			'characterId' in holder
				? (game.ruleReminders?.[holder.characterId] ?? [])
				: looseReminders(game);
		return held.find((r) => r.reminderId === shown);
	});
	const source = $derived(reminder ? characters.get(reminder.characterId) : undefined);
	// Gone from the board (removed, moved to a seat, undone): nothing left to show.
	$effect(() => {
		if (open && shown && !reminder) open = false;
	});
</script>

<Dialog bind:open title="Reminder">
	<!-- The token itself, as on the board (Trevor, 2026-10-30). -->
	{#snippet heading()}
		{#if reminder}<BoardReminder
				{...placedLook(reminder, characters)}
				character={source}
				alignment={placingAlignment(game, reminder, characters)}
			/>{:else}Reminder{/if}
	{/snippet}
	{#snippet subtitle()}
		{#if source}From <CharacterBadge characterId={source.id} character={source} />{/if}
		{#if holder && 'characterId' in holder}on <CharacterBadge
				characterId={holder.characterId}
				character={characters.get(holder.characterId)}
			/>{:else}loose on the board{/if}
	{/snippet}
	{#if reminder && isGeneric(reminder)}
		<ReminderNoteField {grimoire} {reminder} />
	{/if}
	{#if source}
		<CharacterSummary character={source} reminders={false} />
	{/if}
	<div class="menu">
		<Button variant="quiet" icon="move" onclick={() => (seatOpen = true)}>Move to a seat</Button>
	</div>
	{#snippet headActions()}
		<ReminderMoreButton {grimoire} reminderId={shown} onDone={() => (open = false)} />
		<DeleteButton
			label="Remove reminder"
			onclick={() => {
				open = false;
				if (shown) onRemove(shown);
			}}
		/>
	{/snippet}
</Dialog>

<SeatChooser
	bind:open={seatOpen}
	title="Move reminder to"
	{game}
	{characters}
	onChoose={(toSeatId) => {
		seatOpen = false;
		open = false;
		if (shown) onMove(shown, toSeatId);
	}}
>
	<!-- It says which reminder moves (Trevor, 2026-10-19). -->
	{#snippet heading()}
		Move {#if reminder}<ReminderToken
				label={tokenLabel(reminder)}
				character={source}
				alignment={placingAlignment(game, reminder, characters)}
			/>{:else}reminder{/if} to
	{/snippet}
</SeatChooser>

<style>
	.menu {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}
</style>
