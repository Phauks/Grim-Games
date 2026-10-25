<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatLabel as seatLabelFor } from '#lib/features/game/seat-label.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import AlignmentPill from './AlignmentPill.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatChanges } from './history.ts';

	/** Changes to who a seat is during the game: its characters and alignments (Trevor, 2026-10-16). */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
		seatId: SeatId | undefined;
	}

	let { open = $bindable(), grimoire, seatId }: Props = $props();

	const characters = $derived(grimoire.open.characters);
	/** "Seat 3 (Cat)", or "Seat 3" with no name. */
	const seatLabel = $derived(seatId === undefined ? '' : seatLabelFor(grimoire.game, seatId));
	const changes = $derived(
		seatId
			? seatChanges(grimoire.open.session.log.entries, grimoire.open.session.log.cursor, seatId)
			: []
	);
</script>

<Dialog bind:open title={`Character history for ${seatLabel}`}>
	<ol class="changes" data-testid="seat-changes">
		{#each changes as change, i (i)}
			<li>
				{#if change.kind === 'character'}
					<CharacterBadge characterId={change.from} character={characters.get(change.from)} />
					→
					<CharacterBadge characterId={change.to} character={characters.get(change.to)} />
				{:else}
					<AlignmentPill alignment={change.from} /> → <AlignmentPill alignment={change.to} />
				{/if}
			</li>
		{/each}
	</ol>
</Dialog>

<style>
	.changes {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.changes li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
	}
</style>
