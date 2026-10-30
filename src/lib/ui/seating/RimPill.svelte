<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A pill of small marks over a token's top rim, half outside it: the board's nominations
	 * on the top left (clear of the left leaf's first-night number, Trevor 2026-10-24) and a
	 * player's other guesses on the top right (Trevor, 2026-10-25). Each mark is a `--slot`
	 * square. The whole pill is one tap target, however small the token. Placed inside
	 * SeatDisc's `marks`, which sizes it by `--size`.
	 *
	 * On the bottom `edge` (the board's held abilities beside the notes mark, Trevor
	 * 2026-10-30) each mark is its own tap target, so the pill takes no tap of its own.
	 */
	interface Props {
		side: 'left' | 'right';
		edge?: 'top' | 'bottom';
		testid: string;
		title?: string;
		children: Snippet;
	}

	let { side, edge = 'top', testid, title, children }: Props = $props();
</script>

<span class="rim-pill" data-side={side} data-edge={edge} data-testid={testid} {title}
	>{@render children()}</span
>

<style>
	.rim-pill {
		position: absolute;
		display: flex;
		gap: calc(0.125 * var(--u));
		padding: calc(0.125 * var(--u));
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		box-shadow: var(--shadow);
		--slot: max(1.25 * var(--u), calc(var(--size) * 0.3));
	}
	.rim-pill[data-edge='top'] {
		top: -8%;
	}
	.rim-pill[data-edge='bottom'] {
		bottom: -8%;
	}
	.rim-pill[data-side='left'] {
		right: 64%;
	}
	.rim-pill[data-side='right'] {
		left: 64%;
	}
	.rim-pill[data-edge='top']::after {
		content: '';
		position: absolute;
		inset: 50% auto auto 50%;
		width: max(100%, var(--tap-target));
		height: max(100%, var(--tap-target));
		translate: -50% -50%;
	}
</style>
