<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import type { CharacterLookup } from '#lib/core/model/characters.ts';
	import type { Game, SeatId } from '#lib/core/model/index.ts';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import BoardReminder from '#lib/features/board/BoardReminder.svelte';
	import { placingAlignment } from '#lib/features/grimoire/board.ts';
	import SeatBadge from '#lib/features/board/SeatBadge.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { LastPlaced } from '#lib/core/engine/last-placed.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';

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
		/**
		 * Where this copy was before tonight (M89, Trevor 2026-11-19): a small line above the
		 * row, with a small button that puts it there again. Never placed by itself.
		 */
		last?: LastPlaced;
		/** Puts this copy on `last`'s seat. */
		onagain?: (seatId: SeatId) => void;
	}

	let { game, characters, character, label, at, onchoose, onreturn, ondrag, last, onagain }: Props =
		$props();
	const lastName = $derived(last?.when === 'day' ? 'Today' : 'Last night');
</script>

<span class="step-reminder">
	{#if last}
		<!-- Last night's (or today's) seat, small, above tonight's (Trevor, 2026-11-19). -->
		<span class="last" data-testid="last-placed">
			<Icon name={last.when === 'day' ? 'day' : 'night'} label={lastName} />
			<SeatBadge {game} {characters} interactive={false} seatId={last.seatId} />
			{#if onagain}<button
					type="button"
					class="again"
					aria-label={`Place ${label} on ${seatName(game, last.seatId)} again`}
					title={`Place ${label} on ${seatName(game, last.seatId)} again`}
					disabled={at?.seatId === last.seatId}
					onclick={() => onagain(last.seatId)}><Icon name="redo" /></button
				>{/if}
		</span>
	{/if}
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
</span>

<style>
	/* The token, its seat and the trash in a row; last night's line over the seat. */
	.step-reminder {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		font-family: var(--font-body);
	}
	/* Small and muted, over the seat button, past the token. */
	.last {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
		grid-column: 2 / -1;
		color: var(--on-surface-muted);
		font-family: var(--font-body);
		font-size: 0.8rem;
	}
	.again {
		position: relative;
		display: grid;
		place-items: center;
		width: 2em;
		height: 1.6em;
		/* Small to see; its hit area (::after) is the full tap target high. */
		min-height: 0;
		--icon-size: 1.1em;
		padding: 0;
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		/* The standard button edge (Trevor: one border for every button). */
		box-shadow: var(--button-ring);
		color: var(--on-surface);
		font: inherit;
		cursor: pointer;
		touch-action: manipulation;
	}
	/* A 44px-tall hit area around the small button, as GlossaryTerm's. */
	.again::after {
		content: '';
		position: absolute;
		inset-inline: 0;
		top: 50%;
		height: var(--tap-target);
		translate: 0 -50%;
	}
	.again:active {
		background: var(--surface-selected);
	}
	.again:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.reminder-row {
		display: contents;
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
