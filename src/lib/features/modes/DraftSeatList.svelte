<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';

	/**
	 * The seats a draft's Storyteller picks from once everyone has drafted (who is really the
	 * Drunk or the Marionette, whom the Kazali turns): each seat with what it drafted beside it,
	 * then one more choice (None, Done).
	 */
	interface Props {
		/** Seats by pick index. */
		seats: readonly number[];
		seatLabel: (seat: number) => string;
		/** What each seat drafted. */
		kept: (seat: number) => Character | undefined;
		onPick: (seat: number) => void;
		/** The last row's button, picking no seat. */
		last: string;
		onLast: () => void;
		testid: string;
	}

	let { seats, seatLabel, kept, onPick, last, onLast, testid }: Props = $props();
</script>

<ul class="seats" data-testid={testid}>
	{#each seats as i (i)}
		{@const drafted = kept(i)}
		<li>
			<Button onclick={() => onPick(i)}>{seatLabel(i)}</Button>
			{#if drafted}<CharacterBadge characterId={drafted.id} character={drafted} />{/if}
		</li>
	{/each}
	<li><Button onclick={onLast}>{last}</Button></li>
</ul>

<style>
	.seats {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.seats li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-block: var(--space-1);
		border-bottom: var(--card-border);
	}
</style>
