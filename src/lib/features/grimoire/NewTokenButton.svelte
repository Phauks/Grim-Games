<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * "+ New token" (plan B9), at the end of the bank's ∞ tokens: hollow, so it reads as a place
	 * to make one, not a token. While a reminder is dragged it takes one as a new ∞ token like it
	 * (Trevor, 2026-10-27), and glows: `ready`, or `over` with the token over it.
	 */
	interface Props {
		glow: 'ready' | 'over' | undefined;
		/** Token diameter in px. */
		size: number;
		disabled: boolean;
		onclick: () => void;
	}

	let { glow, size, disabled, onclick }: Props = $props();
</script>

<button
	type="button"
	class="new-token"
	data-new-token
	data-glow={glow}
	style:--size="{size}px"
	aria-label="New token"
	{disabled}
	{onclick}
>
	<Icon name="add" />
</button>

<style>
	/* "+ New token" (plan B9): a hollow token, so it reads as a place to make one. */
	.new-token {
		position: relative;
		display: grid;
		place-items: center;
		width: var(--size);
		height: var(--size);
		/* A circle at the tokens' own size, as BoardReminder; the ::after keeps the target. */
		min-width: 0;
		min-height: 0;
		padding: 0;
		border: 0.125rem dashed var(--on-surface-muted);
		border-radius: 50%;
		background: none;
		color: var(--on-surface);
	}
	.new-token::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: max(100%, var(--tap-target));
		height: max(100%, var(--tap-target));
		translate: -50% -50%;
		border-radius: 50%;
	}
	.new-token:disabled {
		opacity: 0.5;
	}
	/* While a reminder is dragged it takes one, as a new ∞ token like it (Trevor, 2026-10-27):
	   it glows, breathing, and brighter with the token over it. In the text colour, as the
	   player's own seat glows, since red or blue would read as an alignment. */
	.new-token[data-glow] {
		border-style: solid;
		border-color: var(--on-surface);
		box-shadow: 0 0 calc(0.8 * var(--u)) calc(0.3 * var(--u)) var(--on-surface);
		animation: new-token-glow 1.6s ease-in-out infinite;
	}
	.new-token[data-glow='over'] {
		scale: 1.15;
		box-shadow: 0 0 calc(1.25 * var(--u)) calc(0.5 * var(--u)) var(--on-surface);
		animation: none;
	}
	@keyframes new-token-glow {
		50% {
			box-shadow: 0 0 calc(0.4 * var(--u)) calc(0.1 * var(--u)) var(--on-surface);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.new-token[data-glow] {
			animation: none;
		}
	}
</style>
