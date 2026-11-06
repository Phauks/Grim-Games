<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import { borrowedAbilitiesOf } from '#lib/core/rules/index.ts';
	import type { DayPort } from './day-port.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';

	/**
	 * The abilities a player has besides their own (the Hermit's every Outsider, the
	 * Philosopher's choice, Gain ability, a Boffin's gift), each as the same character row under
	 * their own on the day (Trevor, 2026-11-06: option A, "put it with the character
	 * component"). Marked + as on the seat's pill; one not working just now is faded.
	 */
	interface Props {
		game: DayPort;
		seatId: SeatId | undefined;
	}

	let { game, seatId }: Props = $props();

	const rows = $derived(seatId ? borrowedAbilitiesOf(game.game, seatId, game.characters) : []);
</script>

{#if rows.length > 0}
	<ul class="borrowed" data-testid="borrowed-abilities">
		{#each rows as row (row.characterId)}
			{@const character = game.characters.get(row.characterId)}
			{#if character}
				<li data-character={row.characterId}>
					<CharacterPiece template="row" {character} info faded={!row.works}>
						{#snippet tags()}<span class="has" aria-label="Also has">+</span>{/snippet}
						{#snippet abilityText()}<GlossaryText text={character.ability} />{/snippet}
					</CharacterPiece>
				</li>
			{/if}
		{/each}
	</ul>
{/if}

<style>
	.borrowed {
		display: grid;
		flex-basis: 100%;
		gap: var(--space-1);
		margin: var(--space-1) 0 0;
		padding: 0 0 0 var(--space-4);
		list-style: none;
	}
	/* The same mark and colour as the seat pill's + (HeldAbilityPill). */
	.has {
		display: inline-grid;
		place-items: center;
		width: 1.4em;
		height: 1.4em;
		margin-inline-start: var(--space-1);
		border-radius: 50%;
		background: var(--good);
		color: var(--on-good);
		font-weight: 700;
		line-height: 1;
	}
</style>
