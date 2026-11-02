<script lang="ts">
	import type { PlayerName } from '#lib/core/data/index.ts';

	/**
	 * The player's half of a character with its player: the name on a pale tint of the
	 * character's colour, in a deep shade of it, filling its host's height and ending round
	 * (capsule C, Trevor 2026-11-02). One part for the badge and the row's band (Trevor,
	 * 2026-11-02: the row with a player and the badge with a player "should use the same
	 * part"), so a change to how names look lands on both. Off the grim, a player with their
	 * character is this; PlayerBadge is the name on its own.
	 */
	interface Props {
		name: PlayerName;
		/** The character's colour: its alignment, or its type for Travellers, Fabled and Loric. */
		team: string;
	}

	let { name, team }: Props = $props();
</script>

<!-- eslint-disable grim/names-as-badges -- the player half of the character's badge -->
<span class="player-half" data-team={team} data-testid="player-badge"
	><span class="trim">{name}</span></span
>

<!-- eslint-enable grim/names-as-badges -->

<style>
	.player-half {
		--pale: var(--surface-raised);
		--deep: var(--on-surface);
		display: inline-flex;
		flex: 0 1 auto;
		align-items: center;
		align-self: stretch;
		min-width: 0;
		padding: 0 0.6em 0 0.45em;
		border-radius: 0 var(--radius-full) var(--radius-full) 0;
		background: var(--pale);
		color: var(--deep);
		font-family: var(--font-player);
		/* The size PlayerBadge had inside the badge (0.92em of 0.95em). */
		font-size: 0.875em;
		font-weight: 600;
		line-height: 1;
	}
	.player-half[data-team='good'] {
		--pale: var(--good-pale);
		--deep: var(--good-deep);
	}
	.player-half[data-team='evil'],
	.player-half[data-team='traveller'] {
		--pale: var(--evil-pale);
		--deep: var(--evil-deep);
	}
	.player-half[data-team='fabled'] {
		--pale: var(--fabled-pale);
		--deep: var(--fabled-deep);
	}
	.player-half[data-team='loric'] {
		--pale: var(--loric-pale);
		--deep: var(--loric-deep);
	}
	/* Centred on the letters, as the badge's name is; a long name ends in "…". */
	.trim {
		display: block;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-box: trim-both cap alphabetic;
		padding-block: 0.3em;
		margin-block: -0.3em;
	}
</style>
