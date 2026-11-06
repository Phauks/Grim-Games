<script lang="ts" module>
	/** How a character is tied to the player on the row above. */
	export type Relation = 'holds' | 'is' | 'believes' | 'mad';
</script>

<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import CharacterPiece from './CharacterPiece.svelte';

	/**
	 * Characters tied to a player besides the one on their row, each as the same character row
	 * under it (Trevor, 2026-11-06: "put it with the character component"), marked as on the
	 * seat's pill (HeldAbilityPill): + also has their ability, = is really, ? believes they
	 * are, ! is mad as. One whose ability doesn't work just now is faded. Day view and the seat
	 * sheet show them the same way.
	 */
	interface Props {
		rows: readonly { character: Character; relation: Relation; faded?: boolean }[];
	}

	let { rows }: Props = $props();

	const MARK: Record<Relation, string> = { holds: '+', is: '=', believes: '?', mad: '!' };
</script>

{#if rows.length > 0}
	<ul class="marked" data-testid="marked-characters">
		{#each rows as row (`${row.relation}:${row.character.id}`)}
			<li data-character={row.character.id} data-relation={row.relation}>
				<CharacterPiece template="row" character={row.character} info faded={row.faded}>
					{#snippet tags()}<span
							class="mark {row.relation}"
							aria-label={t(`characters.relation.${row.relation}`)}>{MARK[row.relation]}</span
						>{/snippet}
					{#snippet abilityText()}<GlossaryText text={row.character.ability} />{/snippet}
				</CharacterPiece>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.marked {
		display: grid;
		flex-basis: 100%;
		gap: var(--space-1);
		margin: var(--space-1) 0 0;
		padding: 0 0 0 var(--space-4);
		list-style: none;
	}
	/* The same marks and colours as the seat pill's (HeldAbilityPill, SeatMarksSheet). */
	.mark {
		display: inline-grid;
		place-items: center;
		width: 1.4em;
		height: 1.4em;
		margin-inline-start: var(--space-1);
		border: 1px solid var(--on-surface); /* px-ok: a hairline so the mark shows on the band */
		border-radius: 50%;
		font-weight: 700;
		line-height: 1;
	}
	.mark.holds {
		background: var(--good);
		color: var(--on-good);
	}
	.mark.is {
		background: var(--evil);
		color: var(--on-evil);
	}
	.mark.believes {
		background: var(--accent);
		color: var(--on-accent);
	}
	.mark.mad {
		background: var(--fabled);
		color: var(--on-fabled);
	}
</style>
