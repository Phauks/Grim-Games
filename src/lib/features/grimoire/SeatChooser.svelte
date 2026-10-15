<script lang="ts">
	import type { CharacterLookup, Game, SeatId } from '#lib/core/model/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open: boolean;
		title: string;
		game: Game;
		characters: CharacterLookup;
		/** Left out of the list (the seat the choice starts from). */
		exclude?: SeatId;
		onChoose: (seatId: SeatId) => void;
	}

	let { open = $bindable(), title, game, characters, exclude, onChoose }: Props = $props();

	const seats = $derived(
		game.seating.map((seatId, i) => ({ seat: game.seats[seatId], number: i + 1 }))
	);
</script>

<Dialog bind:open {title}>
	<ul>
		{#each seats as { seat, number } (seat.seatId)}
			{#if seat.seatId !== exclude}
				{@const character = seat.characterId ? characters.get(seat.characterId) : undefined}
				<li>
					<button type="button" onclick={() => onChoose(seat.seatId)}>
						<span class="slot"
							>{#if character}<CharacterToken
									{character}
									alignment={seat.alignment}
									size={36}
								/>{/if}</span
						>
						<span class="number">{number}</span>
						<span class="name">{seat.playerName ?? `Seat ${number}`}</span>
						<span class="role">{character?.name ?? 'None'}</span>
					</button>
				</li>
			{/if}
		{/each}
	</ul>
</Dialog>

<style>
	ul {
		display: grid;
		gap: 2px;
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
	}
	button {
		display: grid;
		grid-template-columns: 36px 1.5em 1fr auto;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: 2px var(--space-2);
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	button:hover {
		background: var(--surface-selected);
	}
	.slot {
		width: 36px;
		height: 36px;
	}
	.number {
		opacity: 0.7;
		font-variant-numeric: tabular-nums;
	}
	.name {
		font-family: var(--font-player);
	}
	.role {
		font-family: var(--font-character);
		font-size: 0.85rem;
		opacity: 0.85;
	}
</style>
