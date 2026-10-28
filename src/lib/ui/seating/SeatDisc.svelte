<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { FACE_RADIUS, type Frame } from '#lib/core/frames/index.ts';
	import DeadBadge from './DeadBadge.svelte';
	import FrameDrawing from './FrameDrawing.svelte';
	import CharacterEmblem from './CharacterEmblem.svelte';
	import AvatarFace from './AvatarFace.svelte';
	import type { AvatarId } from '#lib/core/avatars/index.ts';
	import PlayerNameMark from '#lib/ui/token/PlayerNameMark.svelte';

	/**
	 * How one seat looks on a ring of seats: the token, the dead mark and the player's name.
	 * Shared by the Storyteller's board and the player's Circle (/play) so a seat, alive or
	 * dead, looks the same on both (Trevor, 2026-10-16). The caller wraps it in its own button
	 * (taps, drags) and passes the face (a character token); without one, the seat number shows.
	 */
	interface Props {
		/** Token size in px. */
		size: number;
		dead?: boolean;
		name: string;
		/** 1-based place in the seating order, shown when there is no face. */
		number: number;
		face?: Snippet;
		/** Marks drawn over or around the token (notes, extra claims, warnings). */
		marks?: Snippet;
		/**
		 * A dead player's ghost vote, which turns the skull badge into a ghost (Trevor,
		 * 2026-10-19: one badge for both): a solid ghost while it is still there.
		 */
		vote?: 'unused' | 'used';
		/** How a used ghost vote looks: a grey outline ghost, or struck through (Trevor, 2026-10-19). */
		usedVote?: 'hollow' | 'struck';
		/**
		 * A frame round the token (L4, Trevor 2026-10-22). It sits inside the token's own
		 * footprint, the face shrinking a little, so nothing around the seat moves.
		 */
		frame?: Frame;
		/** The player's avatar (plan R6, their initials from `name`), shown in place of the number. */
		avatar?: AvatarId;
		/** The player's own picture (a link), in place of their initials (2026-10-27). */
		picture?: string;
		/** The player's representative character in full colour: their own Profile only. */
		fullColour?: boolean;
	}

	let {
		size,
		dead = false,
		name,
		number,
		face,
		marks,
		vote,
		usedVote = 'hollow',
		frame,
		avatar,
		picture,
		fullColour = false
	}: Props = $props();

	const framed = $derived(frame !== undefined && frame.drawing.length > 0);

	/**
	 * A laurel that arrives while the seat is showing, as when its player joins or picks a new
	 * one, grows in up both branches from the foot (Trevor, 2026-10-27: the unlock draw-in
	 * "should also appear when a player joins a grim"). One already there when the board opens
	 * just shows.
	 */
	let shown = untrack(() => frame?.id);
	let growing = $state(false);
	$effect(() => {
		const id = frame?.id;
		if (id === shown) return;
		shown = id;
		growing = untrack(() => framed);
	});
</script>

<span
	class="seat-disc"
	data-dead={dead || undefined}
	data-framed={framed || undefined}
	style:--size="{size}px"
	style:--face-scale={(frame?.faceRadius ?? FACE_RADIUS) / 50}
>
	<span class="disc">
		<!-- Marked as a token face, so a seat button's focus ring is round (base.css). -->
		<span class="face" data-token-face
			>{#if face}{@render face()}{:else if avatar}<AvatarFace
					{avatar}
					{name}
					{picture}
				/>{:else}<span class="empty">{number}</span>{/if}</span
		>
		{#if frame && framed}<span
				class="frame-layer"
				data-growing={growing || undefined}
				onanimationend={() => (growing = false)}><FrameDrawing {frame} /></span
			>{/if}
		<!-- Over the face, not in it, so the face's own size never moves the name. -->
		<!-- One name badge for every seat, named or empty (Trevor, 2026-10-19). -->
		<!-- Outside the frame layer, so it stays put while the laurel moves (Trevor, 2026-10-28). -->
		<CharacterEmblem {avatar} {fullColour} />
		<PlayerNameMark {name} />
		{#if dead}<DeadBadge {vote} usedLook={usedVote} testid="dead-mark" />{/if}
		{#if marks}{@render marks()}{/if}
	</span>
</span>

<style>
	.seat-disc {
		position: relative;
		display: grid;
		justify-items: center;
		width: calc(var(--size) + 2 * var(--u));
		color: var(--on-surface);
	}
	.disc {
		position: relative;
		width: var(--size);
		height: var(--size);
	}
	.face {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		box-shadow: var(--shadow);
	}
	.empty {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		border: 2px dashed var(--border);
		background: var(--surface-raised);
		color: var(--on-surface-muted);
		font: var(--seat-font);
	}
	/* Framed: the face shrinks into the frame, the disc keeps its size. */
	.seat-disc[data-framed] .face {
		scale: var(--face-scale);
	}
	.frame-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	/* Grows from the foot up both sides: a mask opening as two arcs, and a small pop. */
	@property --grow-sweep {
		syntax: '<angle>';
		inherits: false;
		initial-value: 180deg;
	}
	.frame-layer[data-growing] {
		mask-image: conic-gradient(
			from 180deg,
			currentColor 0deg var(--grow-sweep),
			transparent var(--grow-sweep) calc(360deg - var(--grow-sweep)),
			currentColor calc(360deg - var(--grow-sweep))
		);
		animation: laurel-grow 1.1s cubic-bezier(0.3, 0.7, 0.4, 1.15);
	}
	@keyframes laurel-grow {
		from {
			--grow-sweep: 0deg;
			scale: 0.86;
		}
		to {
			--grow-sweep: 180deg;
			scale: 1;
		}
	}
	/* Dead (Trevor, 2026-10-16): the token dimmed, colour kept, plus a skull badge. */
	.seat-disc[data-dead] :global(.emblem),
	.seat-disc[data-dead] .frame-layer,
	.seat-disc[data-dead] .face {
		filter: brightness(0.55);
	}
	/* One badge on the lower-left rim, half outside the token. */
	.disc :global(.dead-badge) {
		position: absolute;
		left: -10%;
		bottom: -6%;
		--badge-size: calc(var(--size) * 0.38);
	}
	@media (prefers-reduced-motion: reduce) {
		.face {
			transition: none;
		}
		.frame-layer[data-growing] {
			mask-image: none;
			animation: none;
		}
	}
</style>
