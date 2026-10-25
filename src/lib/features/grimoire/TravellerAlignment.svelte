<script lang="ts">
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { Alignment } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatName } from './night-steps.ts';

	/**
	 * The Traveller alignment step, set right in the step (Trevor, 2026-10-16): each
	 * Traveller without one, with Good, Evil, or a draw the Traveller picks from.
	 */
	interface Props {
		grimoire: Grimoire;
		travellers: readonly SeatId[];
		/** Opens the alignment draw, kept by the board: setting the alignment ends this step. */
		onDraw: (seatId: SeatId) => void;
	}

	let { grimoire, travellers, onDraw }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);

	function set(seatId: SeatId, alignment: Alignment) {
		grimoire.run({ type: 'SetAlignment', seatId, alignment });
	}
</script>

<ul class="travellers" data-testid="traveller-alignment">
	{#each travellers as seatId (seatId)}
		{@const id = game.seats[seatId]?.characterId}
		<li>
			{#if id}
				<CharacterBadge
					characterId={id}
					character={characters.get(id)}
					playerName={seatName(game, seatId)}
				/>
			{:else}
				<PlayerBadge name={seatName(game, seatId)} />
			{/if}
			<span class="spacer"></span>
			<Button variant="quiet" onclick={() => set(seatId, 'good')}>Good</Button>
			<Button variant="quiet" onclick={() => set(seatId, 'evil')}>Evil</Button>
			<Button variant="quiet" onclick={() => onDraw(seatId)}>Draw</Button>
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
