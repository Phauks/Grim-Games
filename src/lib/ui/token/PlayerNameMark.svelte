<script lang="ts">
	import type { PlayerNamePlacement } from './token-appearance.ts';

	/**
	 * A seat's player name drawn on its token (Settings > Tokens, Trevor 2026-10-16), for every
	 * placement but `below`, which is the seat's own pill under the token. It fills its parent,
	 * which must be exactly the token's box, and sits over the token rather than inside it, so a
	 * token turned upside down (alignment differs) leaves the name the right way up. The leaves,
	 * the setup flower, the icon and the character name on the edge never move for it.
	 */
	interface Props {
		name: string;
		placement: Exclude<PlayerNamePlacement, 'below'>;
	}

	let { name, placement }: Props = $props();

	const LINE_SIZE = 12;
	const BADGE_SIZE = 10;
	/** Squeezes a long name into `room`; short ones keep their natural width. */
	const fit = (room: number, fontSize: number) =>
		name.length * fontSize * 0.55 > room ? room : undefined;

	// Across the icon: inside the circle the leaf tips reach (radius 30) at the top; at the
	// bottom, above the character name's arc and left of the setup flower.
	const lineY = $derived(placement === 'icon-top' ? 39 : 68);
	const lineLength = $derived(fit(placement === 'icon-top' ? 44 : 38, LINE_SIZE));
	// Badge: a pill straddling the bottom of the rim, below the character name's arc.
	const badgeWidth = $derived(Math.min(96, name.length * BADGE_SIZE * 0.55 + 10));
	const badgeLength = $derived(fit(badgeWidth - 8, BADGE_SIZE));
</script>

<svg
	class="player-name"
	viewBox="0 0 100 100"
	aria-hidden="true"
	data-testid="token-player-name"
	data-placement={placement}
>
	{#if placement === 'badge'}
		<rect x={50 - badgeWidth / 2} y="90" width={badgeWidth} height="14" rx="7" />
		<text
			x="50"
			y="100.5"
			font-size={BADGE_SIZE}
			text-anchor="middle"
			textLength={badgeLength}
			lengthAdjust="spacingAndGlyphs">{name}</text
		>
	{:else}
		<text
			class="on-icon"
			x="50"
			y={lineY}
			font-size={LINE_SIZE}
			text-anchor="middle"
			textLength={lineLength}
			lengthAdjust="spacingAndGlyphs">{name}</text
		>
	{/if}
</svg>

<style>
	.player-name {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	text {
		font-family: var(--font-player);
		font-weight: 600;
	}
	.on-icon {
		fill: var(--on-token);
		stroke: var(--token-face);
		stroke-width: 3;
		stroke-linejoin: round;
		paint-order: stroke;
	}
	/* The same neutral pill as the name under a seat. */
	rect {
		fill: var(--surface-raised);
		stroke: var(--border);
		stroke-width: 0.75;
	}
	rect + text {
		fill: var(--on-surface);
	}
</style>
