<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import type { CharacterLookup } from '#lib/core/model/characters.ts';
	import type { Game, SeatId } from '#lib/core/model/index.ts';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import BoardReminder from '#lib/features/board/BoardReminder.svelte';
	import { placingAlignment } from '#lib/features/grimoire/board.ts';
	import SeatBadge from '#lib/features/board/SeatBadge.svelte';

	/**
	 * One copy of a night step's reminder token (`GuidedStep`): the token, where it is, and back
	 * to the reminder bank. Beneath the line that names it, or under Reminders. No Move button
	 * (Trevor, 2026-11-17, "C Tap badge to move"): where it is is the button that places or
	 * moves it, as tapping or dragging the token does, so the seat's badge has the room.
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
		/** The token dragged onto the board (beside it, not a phone's sheet); `end` when let go. */
		ondrag?: (x: number, y: number, end: boolean | 'cancel') => void;
	}

	let { game, characters, character, label, at, onchoose, onreturn, ondrag }: Props = $props();
</script>

<span class="reminder-row">
	<!-- The token itself, as on the board (Trevor, 2026-10-30), never squeezed. -->
	<!-- Tapped, as Place or Move; dragged, onto the board (Trevor, 2026-11-16). -->
	<span class="token"
		><BoardReminder
			{label}
			{character}
			alignment={character ? placingAlignment(game, character.id, characters) : undefined}
			ariaLabel={`${label} token`}
			onTap={onchoose}
			onDrag={ondrag && ((x, y, end) => ondrag(x, y, end))}
			onCancel={ondrag && (() => ondrag(0, 0, 'cancel'))}
		/></span
	>
	<!-- The seat and its character (Trevor, 2026-10-18), whole: tapping it places or moves the
	     token. -->
	<button
		type="button"
		class="where"
		aria-label={at ? 'Move' : 'Place'}
		title={at ? 'Move' : 'Place'}
		onclick={onchoose}
		>{#if at}<SeatBadge {game} {characters} seatId={at.seatId} />{:else}Not placed{/if}</button
	>
	<!-- Off the board and back to the reminder bank, from the step (Trevor, 2026-10-17);
	     there but unusable while not placed. -->
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
		gap: var(--space-2);
		font-family: var(--font-body);
	}
	.token {
		flex: none;
	}
	.where {
		display: flex;
		flex: 1 1 auto;
		flex-wrap: wrap;
		align-items: center;
		min-width: 0;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 0;
		border-radius: var(--radius-md);
		/* The standard button edge (Trevor: one border for every button). */
		background: none;
		box-shadow: var(--button-ring);
		color: var(--on-surface-muted);
		font: inherit;
		font-size: 0.9rem;
		text-align: start;
		cursor: pointer;
	}
</style>
