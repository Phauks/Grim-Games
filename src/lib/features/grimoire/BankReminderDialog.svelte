<!--
	A reminder's own dialog (Trevor, 2026-10-30: one component for a token from the bank or the
	board), opened by tapping the token in hand's pill, a seat sheet's reminder or a Fabled's:
	where it lies, what a setup suggestion is for, and the ability it comes from. A placed one
	also has its ⋯ (Duplicate) and red trash, and an ∞ one its note, as does one whose rules
	carry the Storyteller's words (the Zenomancer's Goal), with Show to player.
-->
<script lang="ts">
	import {
		looseReminders,
		reminderHolder,
		type ReminderId,
		type ReminderInstance
	} from '#lib/core/model/index.ts';
	import { characterNames } from '#lib/core/rules/character-names.ts';
	import { prepTextSegments, takesNote } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import ReminderAbout from './ReminderAbout.svelte';
	import { placingAlignment } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import type { ReminderHand } from './reminder-hand.svelte.ts';
	import ReminderMoreButton from './ReminderMoreButton.svelte';
	import NotedReminderFields from './NotedReminderFields.svelte';
	import ReminderNoteField from './ReminderNoteField.svelte';
	import { isGeneric, placedLook } from './reminders.ts';

	interface Props {
		grimoire: Grimoire;
		/**
		 * Whose `about` it shows: a bank token, by what it is, or a token on the board (a seat's,
		 * a Fabled or Loric's, or loose), by id.
		 */
		hand: ReminderHand;
		/** Takes a placed one off the board (ReminderMoveConfirm). */
		onRemove?: (reminderId: ReminderId) => void;
	}

	let { grimoire, hand, onRemove }: Props = $props();

	const item = $derived(hand.about?.kind === 'bank' ? hand.about.item : undefined);
	const reminderId = $derived(hand.about?.kind === 'placed' ? hand.about.reminderId : undefined);

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const names = $derived(characterNames([...characters.values()]));
	const scriptNames = $derived([...characters.values()].map((c) => c.name));
	const holder = $derived(reminderId ? reminderHolder(game, reminderId) : undefined);
	const placed = $derived.by((): ReminderInstance | undefined => {
		if (!reminderId || !holder) return undefined;
		const list =
			'seatId' in holder
				? game.seats[holder.seatId].reminders
				: 'characterId' in holder
					? (game.ruleReminders?.[holder.characterId] ?? [])
					: looseReminders(game);
		return list.find((r) => r.reminderId === reminderId);
	});
	const shown = $derived(placed ?? item);
	const owner = $derived(
		shown && !isGeneric(shown) ? characters.get(shown.characterId) : undefined
	);
	// Gone from the board (removed, undone): nothing left to show.
	$effect(() => {
		if (hand.aboutOpen && reminderId && !placed) hand.aboutOpen = false;
	});
</script>

<ReminderAbout bind:open={hand.aboutOpen} {owner} {scriptNames}>
	{#snippet token()}
		{#if placed}<BoardReminder
				{...placedLook(placed, characters)}
				alignment={placingAlignment(game, placed, characters)}
			/>{:else if item}<BoardReminder
				label={item.label}
				character={characters.get(item.characterId)}
				alignment={placingAlignment(game, item, characters)}
				infinite={isGeneric(item)}
				symbol={item.token?.symbol}
				symbolColour={item.token?.symbolColour}
				symbolFill={item.token?.symbolFill}
			/>{:else}About this reminder{/if}
	{/snippet}
	<!-- No "From [Character]": the ability row below names it (Trevor, 2026-11-01). -->
	{#snippet subtitle()}
		{#if holder && 'characterId' in holder}on <CharacterBadge
				characterId={holder.characterId}
				character={characters.get(holder.characterId)}
			/>{:else if holder && 'loose' in holder}loose on the board{/if}
	{/snippet}
	{#if item?.setup}
		{@const s = item.setup.suggestion}
		<p class="text" data-testid="setup-reason">
			{#each prepTextSegments(s.text, names) as part, j (j)}{#if part.kind === 'reminder'}<ReminderToken
						label={part.label}
						character={owner}
					/>{:else if part.kind === 'character'}<CharacterBadge
						characterId={part.id}
						character={characters.get(part.id)}
					/>{:else}{part.text}{/if}{/each}
		</p>
	{/if}
	{#if placed && isGeneric(placed)}<ReminderNoteField
			{grimoire}
			reminder={placed}
		/>{:else if placed && takesNote(placed, characters)}<NotedReminderFields
			{grimoire}
			reminder={placed}
		/>{/if}
	{#snippet headActions()}
		{#if placed}
			<ReminderMoreButton {grimoire} {reminderId} onDone={() => (hand.aboutOpen = false)} />
			<DeleteButton
				label="Remove reminder"
				onclick={() => {
					hand.aboutOpen = false;
					if (reminderId) onRemove?.(reminderId);
				}}
			/>
		{/if}
	{/snippet}
</ReminderAbout>

<style>
	.text {
		margin: 0 0 var(--space-3);
		line-height: 1.9;
	}
</style>
