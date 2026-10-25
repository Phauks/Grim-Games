<script lang="ts">
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import type { Snippet } from 'svelte';
	import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open: boolean;
		title: string;
		/** Replaces the title's text, e.g. "Put [reminder] on" with the reminder's token. */
		heading?: Snippet;
		/** Beside the X, e.g. a bank token's ⋯ (Trevor, 2026-10-20). */
		headActions?: Snippet;
		game: Game;
		characters: CharacterLookup;
		/** Left out of the list (the seat the choice starts from). */
		exclude?: SeatId;
		onChoose: (seatId: SeatId) => void;
		/** A first "None" row, for a choice that can be cleared (a nomination). */
		onNone?: () => void;
		/** Only these seats are offered (a nomination's nominator: not the dead). */
		offer?: (seatId: SeatId) => boolean;
		/** Marks at the end of each row, in a column of their own (today's nominations). */
		rowMarks?: Snippet<[SeatId]>;
	}

	let {
		open = $bindable(),
		title,
		heading,
		headActions,
		game,
		characters,
		exclude,
		onChoose,
		onNone,
		offer,
		rowMarks
	}: Props = $props();

	const seats = $derived(
		game.seating.map((seatId, i) => ({ seat: game.seats[seatId], number: i + 1 }))
	);
</script>

<Dialog bind:open {title} {heading} {headActions}>
	<ul data-marks={rowMarks ? '' : undefined}>
		{#if onNone}
			<li>
				<button type="button" class="none" onclick={() => onNone?.()}>None</button>
			</li>
		{/if}
		{#each seats as { seat, number } (seat.seatId)}
			{#if seat.seatId !== exclude && (offer?.(seat.seatId) ?? true)}
				{@const character = seat.characterId ? characters.get(seat.characterId) : undefined}
				<li>
					<!-- Number, character, player (Trevor, 2026-10-20): the character once, as its
					     in-line badge, and a line between rows. -->
					<button type="button" onclick={() => onChoose(seat.seatId)}>
						<span class="number">{number}</span>
						<span class="role"
							>{#if character}<CharacterBadge
									characterId={character.id}
									{character}
									alignment={seat.alignment}
									interactive={false}
								/>{:else}None{/if}</span
						>
						<span class="name"><PlayerBadge name={seatName(game, seat.seatId)} /></span
						>{#if rowMarks}<span class="marks">{@render rowMarks(seat.seatId)}</span>{/if}
					</button>
				</li>
			{/if}
		{/each}
	</ul>
</Dialog>

<style>
	ul {
		display: grid;
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
	}
	button {
		display: grid;
		grid-template-columns: 1.5em minmax(0, 1fr) minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: calc(0.125 * var(--u)) var(--space-2);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	ul[data-marks] button {
		grid-template-columns: 1.5em minmax(0, 1fr) minmax(0, 1fr) auto;
	}
	.none {
		display: flex;
	}
	.marks {
		display: flex;
		gap: var(--space-1);
	}
	button:hover {
		background: var(--surface-selected);
	}
	li + li {
		border-top: 1px solid var(--border); /* px-ok: a hairline between rows */
	}
	.number {
		opacity: 0.7;
		font-variant-numeric: tabular-nums;
	}
	.role,
	.name {
		display: flex;
		min-width: 0;
	}
	.role {
		font-family: var(--font-character);
		font-size: 0.85rem;
	}
</style>
