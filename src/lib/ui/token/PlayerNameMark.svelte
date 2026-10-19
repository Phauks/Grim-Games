<script lang="ts">
	/**
	 * A seat's player name in a pill straddling the bottom of its token's rim (Trevor,
	 * 2026-10-17: "player name is badge"). It fills its parent, which must be exactly the
	 * token's box, and sits over the token rather than inside it. The leaves, the
	 * icon and the character name on the edge never move for it.
	 */
	interface Props {
		name: string;
	}

	let { name }: Props = $props();

	const SIZE = 10;
	const width = $derived(Math.min(96, name.length * SIZE * 0.55 + 10));
	/** Squeezes a long name into the pill; short ones keep their natural width. */
	const length = $derived(name.length * SIZE * 0.55 > width - 8 ? width - 8 : undefined);
</script>

<svg class="player-name" viewBox="0 0 100 100" aria-hidden="true" data-testid="token-player-name">
	<rect x={50 - width / 2} y="90" {width} height="14" rx="7" />
	<text
		x="50"
		y="100.5"
		font-size={SIZE}
		text-anchor="middle"
		textLength={length}
		lengthAdjust="spacingAndGlyphs">{name}</text
	>
</svg>

<style>
	.player-name {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
		/* The badge size setting (--name-scale, Trevor 2026-10-17) grows it from its middle;
		   --name-offset moves it down, a share of the token (Trevor, 2026-10-18). */
		transform: translateY(calc(var(--name-offset, 0) * 100%)) scale(var(--name-scale, 1));
		transform-origin: 50% 97%;
	}
	text {
		font-family: var(--font-player);
		font-weight: 600;
		fill: var(--on-surface);
	}
	/* The same neutral pill as the name under a seat. */
	rect {
		fill: var(--surface-raised);
		stroke: var(--border);
		stroke-width: 0.75;
	}
</style>
