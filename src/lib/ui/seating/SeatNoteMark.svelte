<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * A seat's note mark: a small disc on the token's lower right rim. One mark for the
	 * Storyteller's note on the board and a player's own note on their grim (Trevor,
	 * 2026-10-25: the same icon and the same behaviour); tapping it opens that note. Placed
	 * inside SeatDisc's `marks`, which sizes it by `--size`.
	 */
</script>

<span class="mark note" data-testid="note-mark" title="Note"><Icon name="notes" /></span>

<style>
	.mark {
		position: absolute;
		right: -4%;
		bottom: -4%;
		display: grid;
		place-items: center;
		width: max(1.125 * var(--u), calc(var(--size) * 0.3));
		height: max(1.125 * var(--u), calc(var(--size) * 0.3));
		border-radius: 50%;
		background: var(--surface-raised);
		color: var(--on-surface);
		box-shadow: var(--shadow);
		--icon-size: calc(max(1.125 * var(--u), calc(var(--size) * 0.3)) * 0.65);
	}
	/* A tap target bigger than the mark it shows (Trevor, 2026-10-19: tap it for the notes). */
	.mark::after {
		content: '';
		position: absolute;
		inset: calc(-0.875 * var(--u));
		border-radius: 50%;
	}
</style>
