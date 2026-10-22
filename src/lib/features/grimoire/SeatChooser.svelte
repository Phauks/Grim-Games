<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open: boolean;
		title: string;
		/** Replaces the title's text, e.g. "Put [reminder] on" with the reminder's token. */
		heading?: Snippet;
		game: Game;
		characters: CharacterLookup;
		/** Left out of the list (the seat the choice starts from). */
		exclude?: SeatId;
		onChoose: (seatId: SeatId) => void;
	}

	let { open = $bindable(), title, heading, game, characters, exclude, onChoose }: Props = $props();

	const seats = $derived(
		game.seating.map((seatId, i) => ({ seat: game.seats[seatId], number: i + 1 }))
	);
</script>

<Dialog bind:open {title} {heading}>
	<ul>
		{#each seats as { seat, number } (seat.seatId)}
			{#if seat.seatId !== exclude}
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
						<span class="name">{seat.playerName ?? `Seat ${number}`}</span>
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
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.name {
		font-family: var(--font-player);
	}
	.role {
		font-family: var(--font-character);
		font-size: 0.85rem;
	}
</style>
