<script lang="ts">
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { FLOWER_ANGLE, leafLayout, type LeafMarks } from './leaves.ts';

	interface Props {
		/** Icon image URL; the face stays (empty) when there is none. */
		src?: string;
		/** Accessible name: the character and what the leaves say. */
		label: string;
		leaves: LeafMarks;
		/** Fixed size in px, so the token never changes size when data or icons arrive. */
		size?: number;
		/** The character's name, written on the token (grimoire tokens, when the setting is on). */
		name?: string;
		/**
		 * Night order numbers in a badge on the side leaves (Settings, Trevor 2026-10-17): the
		 * first night on the left leaf, other nights on the right. Shown only with the leaf.
		 */
		nightNumbers?: { first?: number; other?: number };
	}

	let { src, label, leaves, size = 56, name, nightNumbers }: Props = $props();
	// Each badge sits on the middle of its leaf (the leaf runs from the rim inwards). The
	// user's Night order badge size (--night-badge-scale) scales it about that point.
	const badges = $derived(
		[
			{ night: 'first', x: 12.5, value: leaves.firstNight ? nightNumbers?.first : undefined },
			{ night: 'other', x: 87.5, value: leaves.otherNight ? nightNumbers?.other : undefined }
		].flatMap((b) =>
			b.value === undefined
				? []
				: [{ ...b, text: String(b.value), width: Math.max(16, 7 + String(b.value).length * 6.5) }]
		)
	);
	// Settings > Tokens: the reminder leaves (on) and the setup flower (off) can be switched.
	const appearance = $derived(preferences.current.tokenAppearance);
	const layout = $derived(
		leafLayout(appearance.reminderLeaves ? leaves : { ...leaves, reminders: 0 })
	);
	const flower = $derived(appearance.setupFlower && !!leaves.setup);
	// A leaf pointing up from (0,0) to (0,-19), with a midrib. Leaves hang from the rim of the
	// face towards the middle, always inside the token (Trevor, 2026-10-15).
	const LEAF = 'M0 0 C7 -5 7 -13 0 -19 C-7 -13 -7 -5 0 0 Z';
	// The setup flower: five petals round a centre, inside the face at the bottom right.
	const FLOWER_R = 36;
	const flowerX = 50 + FLOWER_R * Math.cos((FLOWER_ANGLE * Math.PI) / 180);
	const flowerY = 50 + FLOWER_R * Math.sin((FLOWER_ANGLE * Math.PI) / 180);
	const PETALS = [0, 72, 144, 216, 288];

	const NAME_SIZE = 13;
	/** Squeezes a long name into `room`; short ones keep their natural width. */
	const fit = (room: number, fontSize = NAME_SIZE) =>
		name && name.length * fontSize * 0.62 > room ? room : undefined;

	// Edge: along the bottom inside the rim, clear of the side leaves (at 180° and 0°). With
	// the setup flower (at 45°) it stops short of the flower only when Settings > Tokens says so
	// (off by default, Trevor 2026-10-19). The top of the rim belongs to the reminder leaves.
	const EDGE_R = 37;
	const EDGE_FROM = 150;
	const edgeTo = $derived(flower && appearance.setupMovesName ? 68 : 30);
	const edgePath = $derived.by(() => {
		const point = (degrees: number) => {
			const a = (degrees * Math.PI) / 180;
			return `${(50 + EDGE_R * Math.cos(a)).toFixed(2)} ${(50 + EDGE_R * Math.sin(a)).toFixed(2)}`;
		};
		return `M ${point(EDGE_FROM)} A ${EDGE_R} ${EDGE_R} 0 0 0 ${point(edgeTo)}`;
	});
	const edgeLength = $derived(fit((EDGE_R * (EDGE_FROM - edgeTo) * Math.PI) / 180));

	const pathId = $props.id();
</script>

<!-- Drawn at the size given: the Character token size setting only sizes the board's seats
     (Trevor, 2026-10-19), which pass it in. -->
<span class="token" role="img" aria-label={label} style:--token-size="{size}px">
	<svg viewBox="0 0 100 100" aria-hidden="true">
		<circle class="face" cx="50" cy="50" r="48" />
	</svg>
	<!-- The icon fills most of the face, as on a real token (Trevor, 2026-10-16). -->
	{#if src}<img {src} alt="" width={size} height={size} loading="lazy" />{/if}
	<!-- Leaves are drawn over the icon, so they always show. -->
	<svg class="marks" viewBox="0 0 100 100" aria-hidden="true">
		{#each layout as leaf, i (i)}
			<g
				class="leaf"
				data-kind={leaf.kind}
				transform="rotate({leaf.angle + 90} 50 50) translate(50 5) rotate(180) scale(0.8)"
			>
				<path d={LEAF} />
				<path class="rib" d="M0 -2 L0 -16" />
			</g>
		{/each}
		{#if flower}
			<g
				class="flower"
				data-kind="setup"
				data-testid="setup-flower"
				transform="translate({flowerX} {flowerY})"
			>
				{#each PETALS as angle (angle)}
					<ellipse cx="0" cy="-4.2" rx="2.8" ry="4.2" transform="rotate({angle})" />
				{/each}
				<circle class="centre" r="2.4" />
			</g>
		{/if}
		{#if name}
			<path id="name-{pathId}" d={edgePath} fill="none" />
			<text class="name" font-size={NAME_SIZE} text-anchor="middle" data-testid="token-name"
				><textPath
					href="#name-{pathId}"
					startOffset="50%"
					textLength={edgeLength}
					lengthAdjust="spacingAndGlyphs">{name}</textPath
				></text
			>
		{/if}
	</svg>
	{#if badges.length}
		<svg class="night-badges" viewBox="0 0 100 100" aria-hidden="true">
			{#each badges as badge (badge.night)}
				<g
					class="night-badge"
					data-testid="night-badge"
					data-night={badge.night}
					style:transform="translate({badge.x}px, 50px) scale(var(--night-badge-scale, 1))"
				>
					<rect x={-badge.width / 2} y="-8" width={badge.width} height="16" rx="8" />
					<text y="4" font-size="11" text-anchor="middle">{badge.text}</text>
				</g>
			{/each}
		</svg>
	{/if}
</span>

<style>
	.token {
		position: relative;
		display: inline-block;
		flex: none;
		width: var(--token-size);
		height: var(--token-size);
	}
	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	/* Badges may reach past the rim at large sizes. */
	.night-badges {
		overflow: visible;
		pointer-events: none;
	}
	/* The same neutral pill as the player name badge (PlayerNameMark). */
	.night-badge rect {
		fill: var(--surface-raised);
		stroke: var(--border);
		stroke-width: 0.75;
	}
	.night-badge text {
		fill: var(--on-surface);
		font-family: var(--font-control);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.face {
		fill: var(--token-face);
		stroke: var(--token-face-shade, var(--border));
		stroke-width: 2;
	}
	.flower ellipse {
		fill: var(--token-flower);
	}
	.flower .centre {
		fill: var(--token-flower-centre);
	}
	.leaf path {
		fill: var(--leaf);
	}
	.leaf .rib {
		fill: none;
		stroke: var(--token-face);
		stroke-width: 1;
		opacity: 0.6;
	}
	img {
		position: absolute;
		left: 13%;
		top: 13%;
		width: 74%;
		height: 74%;
		object-fit: contain;
	}
	.name {
		fill: var(--on-token);
		font-family: var(--font-character);
		font-weight: 700;
	}
</style>
