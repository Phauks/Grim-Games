<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import AlignmentPill from '#lib/features/board/AlignmentPill.svelte';
	import type { SeatGuess } from './grim-guesses.ts';

	/**
	 * A seat's guesses in its sheet on the player's Grim, newest first (Trevor, 2026-10-25). A
	 * tap takes one off (2026-11-10).
	 */
	interface Props {
		entries: readonly SeatGuess[];
		onPick: (id: CharacterId) => void;
	}

	let { entries, onPick }: Props = $props();
</script>

<ul class="chips" aria-label={t('player.grim.guesses')}>
	{#each entries as g (g.id)}
		<li>
			<button type="button" class="chip" onclick={() => onPick(g.id)}
				>{#if g.generic}<AlignmentPill
						alignment={g.generic.team}
						text={g.label ?? ''}
					/>{:else}<CharacterPiece
						template="badge"
						characterId={g.id}
						character={g.character}
						interactive={false}
					/>{/if}</button
			>
		</li>
	{:else}
		<li class="none">{t('common.none')}</li>
	{/each}
</ul>

<style>
	/* One line of up to three, so adding a guess moves nothing below it. Every
	   entry shrinks to share the line, a name ending in "…" (CharacterBadge), so none is cut
	   off past the sheet's right edge on a phone (Trevor, 2026-10-31). */
	.chips {
		display: flex;
		gap: var(--space-1);
		min-width: 0;
		margin: 0;
		padding: 0;
		overflow: hidden;
		list-style: none;
	}
	.chips > li {
		display: flex;
		flex: 0 1 auto;
		min-width: 0;
	}
	.chip {
		display: grid;
		grid-template-columns: minmax(0, auto);
		place-items: center;
		min-width: 0;
		max-width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-1);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		font: inherit;
		cursor: pointer;
	}
	.chip > :global(*) {
		max-width: 100%;
	}
	.none {
		color: var(--on-surface-muted);
	}
</style>
