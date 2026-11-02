<script lang="ts">
	import type { PlayerName } from '#lib/core/data/index.ts';

	/**
	 * A player's name inside a line of text: the same neutral pill as the name under a seat's
	 * token (PlayerNameMark), so a name looks the same on the board, in sheets and in
	 * sentences (Trevor, 2026-10-24: "wherever we invoke a player name, we should use the
	 * player name badge that is on the grim"). Sized like CharacterBadge, so it never makes a
	 * line taller, and it never wraps: a long name ends in "…" inside the pill.
	 */
	interface Props {
		name: PlayerName;
	}

	let { name }: Props = $props();
</script>

<!-- eslint-disable-next-line grim/names-as-badges -- this is the badge -->
<span class="player-badge" data-testid="player-badge"><span class="text">{name}</span></span>

<style>
	.player-badge {
		display: inline-flex;
		align-items: center;
		max-width: 100%;
		min-width: 0;
		height: calc(1.3em * var(--inline-name-badge, 1));
		padding: 0 calc(0.5em * var(--inline-name-badge, 1));
		box-sizing: border-box;
		border-radius: var(--radius-full);
		/* The seat pill's colours and edge (PlayerNameMark's rect). */
		background: var(--surface-raised);
		box-shadow: var(--button-ring);
		color: var(--on-surface);
		font-family: var(--font-player);
		font-size: 0.92em;
		font-weight: 600;
		line-height: 1;
		/* Centred on the text's x-height, like CharacterBadge (grim-games-ui-rules). */
		vertical-align: middle;
	}
	/*
	 * Centred on the letters, not the font's line box (Trevor, 2026-11-02), as CharacterBadge
	 * does: trimmed to cap height and baseline, with the same room added back above and below
	 * so descenders are not clipped. A long name ends in "…" inside the pill.
	 */
	.text {
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
