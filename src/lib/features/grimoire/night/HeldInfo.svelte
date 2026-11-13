<script lang="ts">
	import { seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { heldInfo } from '#lib/core/rules/night/info/held-info.ts';
	import ShowToPlayerButton from '#lib/features/show/ShowToPlayerButton.svelte';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import type { CharacterId } from '#lib/core/data/index.ts';

	/**
	 * One Day More's Signal Failure (https://beardytas.com/garden-of-djinn/one-day-more/): on a
	 * step whose information is delayed (`infoDelay`), what the player gets tonight is what was
	 * worked out last night, and tonight's is kept for tomorrow. Drawn whenever the rule delays
	 * the step, with "None" when nothing is held, so the step keeps its shape.
	 */
	interface Props {
		grimoire: Grimoire;
		characterId: CharacterId;
		seats: readonly SeatId[];
		onShowAnswer: (answer: string) => void;
	}

	let { grimoire, characterId, seats, onShowAnswer }: Props = $props();

	const game = $derived(grimoire.game);
	const held = $derived(
		seats.map((seatId) => ({
			seatId,
			items: heldInfo(game, seatId, characterId, grimoire.open.characters)
		}))
	);
</script>

<section class="held" data-testid="held-info" aria-label="Held from last night">
	<h4>Held from last night</h4>
	{#each held as { seatId, items } (seatId)}
		{#if seats.length > 1}<p class="who"><PlayerBadge name={seatName(game, seatId)} /></p>{/if}
		{#if items.length === 0}
			<p class="muted">None</p>
		{:else}
			<ul>
				{#each items as item (item.entryId)}
					<li>
						<span class="text">{item.text}</span>
						{#if item.impaired}<span class="tag" data-testid="held-impaired"
								>Drunk or poisoned now: may be false</span
							>{/if}
						<ShowToPlayerButton onclick={() => onShowAnswer(item.shows)} />
					</li>
				{/each}
			</ul>
		{/if}
	{/each}
	<p class="note" data-testid="held-note">Tonight’s information is kept for tomorrow night.</p>
</section>

<style>
	.held {
		display: grid;
		gap: var(--space-1);
		margin-block: var(--space-2);
	}
	h4 {
		margin: 0;
		font-size: 1rem;
	}
	ul {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.text {
		flex: 1 1 auto;
	}
	.muted,
	.who,
	.note {
		margin: 0;
	}
	.muted,
	.note {
		color: var(--on-surface-muted);
	}
	.tag {
		font-size: 0.875rem;
		color: var(--on-surface-muted);
	}
</style>
