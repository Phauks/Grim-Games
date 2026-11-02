<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatName } from './night-steps.ts';

	/**
	 * The night's offer to bring each Traveller not in play into play (Trevor, 2026-11-02):
	 * Alive is a switch that puts them in play, kept in the list so a slip can be taken back;
	 * one left out stays out until the Storyteller says.
	 */
	interface Props {
		grimoire: Grimoire;
		travellers: readonly SeatId[];
	}

	let { grimoire, travellers }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
</script>

<ul class="travellers" data-testid="traveller-joins">
	{#each travellers as seatId (seatId)}
		{@const id = game.seats[seatId]?.characterId}
		{@const alive = !game.seats[seatId]?.notInPlay}
		<li>
			{#if id}
				<CharacterBadge
					characterId={id}
					character={characters.get(id)}
					playerName={seatName(game, seatId)}
				/>
			{/if}
			<span class="spacer"></span>
			<Button
				variant="quiet"
				icon="alive"
				aria-pressed={alive}
				onclick={() => grimoire.run({ type: 'SetInPlay', seatIds: [seatId], inPlay: !alive })}
				>Alive</Button
			>
		</li>
	{/each}
</ul>

<style>
	.travellers {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
	.spacer {
		flex: 1;
	}
</style>
