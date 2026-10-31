<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { AvatarId } from '#lib/core/avatars/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import AlignmentPill from '#lib/features/grimoire/AlignmentPill.svelte';
	import AvatarFace from '#lib/ui/seating/AvatarFace.svelte';
	import type { GenericGuess } from './grim-guesses.ts';

	/**
	 * A seat's guesses in its sheet on the player's Grim, front first (Trevor, 2026-10-25): its
	 * guesses and, once it has one, the player's avatar (2026-10-26). The front one is pressed;
	 * a tap on another brings it to the front.
	 */
	interface Props {
		entries: readonly {
			id: CharacterId;
			character?: Character;
			generic?: GenericGuess;
			avatar?: AvatarId;
			name?: string;
			label?: string;
			picture?: string;
		}[];
		onPick: (id: CharacterId) => void;
	}

	let { entries, onPick }: Props = $props();
</script>

<ul class="chips" aria-label={t('player.grim.guesses')}>
	{#each entries as g, i (g.id)}
		<li>
			<button
				type="button"
				class="chip"
				aria-pressed={i === 0}
				aria-label={g.avatar ? g.label : undefined}
				onclick={() => onPick(g.id)}
				>{#if g.avatar}<span class="avatar-chip"
						><AvatarFace avatar={g.avatar} name={g.name ?? ''} picture={g.picture} /></span
					>{:else if g.generic}<AlignmentPill
						alignment={g.generic.team}
						text={g.label ?? ''}
					/>{:else}<CharacterBadge
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
	/* One line of up to three and the avatar, so adding a guess moves nothing below it. Every
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
	/* The main guess, the one on the token. */
	.chip[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--surface-selected);
	}
	.none {
		color: var(--on-surface-muted);
	}
	/* The seat's avatar in its cycle, the size of a badge's icon. */
	.avatar-chip {
		display: block;
		width: 2em;
		height: 2em;
	}
</style>
