<script lang="ts">
	import type { CharacterLookup } from '#lib/core/model/characters.ts';
	import type { Game } from '#lib/core/model/index.ts';
	import type { TokenPlacement } from '#lib/core/engine/last-placed.ts';
	import SeatBadge from '#lib/features/board/SeatBadge.svelte';
	import { phaseText } from '#lib/features/game/phase-text.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * Every seat a night step's token was put on this game, night by night (M89, Trevor
	 * 2026-11-19: tap last night's night or day to see that token's history).
	 */
	interface Props {
		open: boolean;
		game: Game;
		characters: CharacterLookup;
		label: string;
		history: readonly TokenPlacement[];
	}

	let { open = $bindable(), game, characters, label, history }: Props = $props();
</script>

<Dialog bind:open title={`${label} history`}>
	<ol class="history" data-testid="token-history">
		{#each history as p, i (i)}
			<li>
				<span class="when">{phaseText(p.phase)}</span>
				<SeatBadge {game} {characters} interactive={false} seatId={p.seatId} />
			</li>
		{/each}
	</ol>
</Dialog>

<style>
	.history {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.history li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.when {
		min-width: 5em;
		color: var(--on-surface-muted);
	}
</style>
