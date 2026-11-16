<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { SeatMessages } from './seat-messages.ts';

	/**
	 * A seat's note mark: a small disc on the token's lower right rim. One mark for the
	 * Storyteller's note on the board and a player's own note on their grim (Trevor,
	 * 2026-10-25: the same icon and the same behaviour); tapping it opens that note. While the
	 * player has messages the Storyteller hasn't read, it shows the messages icon instead, in
	 * the accent colour when one asks to talk or reports a picture (plan M86, Trevor
	 * 2026-11-15: "show on a player icon when there is a message they have sent"); tapping it
	 * opens that player in Players. Placed inside SeatDisc's `marks`, which sizes it by `--size`.
	 */
	let { messages }: { messages?: SeatMessages } = $props();
</script>

<span
	class="mark note"
	data-testid="note-mark"
	data-messages={messages}
	title={messages ? 'New message' : 'Note'}><Icon name={messages ? 'messages' : 'notes'} /></span
>

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
	.mark[data-messages='urgent'] {
		background: var(--accent);
		color: var(--on-accent);
	}
	/* A tap target bigger than the mark it shows (Trevor, 2026-10-19: tap it for the notes). */
	.mark::after {
		content: '';
		position: absolute;
		inset: calc(-0.875 * var(--u));
		border-radius: 50%;
	}
</style>
