<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import type { CharacterLookup } from '#lib/core/model/characters.ts';
	import type { Game, SeatId } from '#lib/core/model/index.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import BoardReminder from '#lib/features/board/BoardReminder.svelte';
	import { placingAlignment } from './board.ts';
	import SeatBadge from '#lib/features/board/SeatBadge.svelte';

	/**
	 * One copy of a night step's reminder token (`GuidedStep`): the token, where it is, Place or
	 * Move, and back to the reminder bank. Beneath the line that names it, or under Reminders.
	 */
	interface Props {
		game: Game;
		characters: CharacterLookup;
		/** Whose token it is. */
		character?: Character;
		label: string;
		/** Where this copy is on the board, if it is. */
		at?: { seatId: SeatId; reminderId: string };
		/** Place or Move: the step closes with the token in hand. */
		onchoose: () => void;
		/** Off the board, back to the reminder bank. */
		onreturn: (reminderId: string) => void;
	}

	let { game, characters, character, label, at, onchoose, onreturn }: Props = $props();
</script>

<span class="reminder-row">
	<!-- The token itself, as on the board (Trevor, 2026-10-30). -->
	<BoardReminder
		{label}
		{character}
		alignment={character ? placingAlignment(game, character.id, characters) : undefined}
	/>
	<!-- The seat and its character (Trevor, 2026-10-18), on one line: the badge with its player. -->
	<span class="where"
		>{#if at}On <SeatBadge {game} {characters} seatId={at.seatId} />{:else}Not placed{/if}</span
	>
	<Button variant="quiet" onclick={onchoose}>{at ? 'Move' : 'Place'}</Button>
	<!-- Off the board and back to the reminder bank, from the step (Trevor, 2026-10-17); there
	     but unusable while not placed. -->
	<DeleteButton
		label={`Return ${label} to the reminder bank`}
		disabled={!at}
		onclick={() => at && onreturn(at.reminderId)}
	/>
</span>

<style>
	.reminder-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-family: var(--font-body);
	}
	.where {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
