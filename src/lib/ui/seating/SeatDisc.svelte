<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { FACE_RADIUS, type Frame } from '#lib/core/frames/index.ts';
	import DeadBadge from './DeadBadge.svelte';
	import FrameDrawing from './FrameDrawing.svelte';
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
		 * A frame round the token (L4, Trevor 2026-10-22). The face keeps the size every other
		 * seat's has (Trevor, 2026-10-31: a token with a laurel was smaller), and the frame is
		 * drawn round it, past the token's edge, without moving anything around the seat.
		 */
		frame?: Frame;
		/** The player's avatar (plan R6, their initials from `name`), shown in place of the number. */
		avatar?: AvatarId;
		/** The player's own picture (a link), in place of their initials (2026-10-27). */
		picture?: string;
		/**
		 * At the table but not in play yet (Trevor, 2026-10-31): the token is greyed and this
		 * label sits across it in a pill, over the token so nothing moves.
		 */
		notInPlay?: string;
		/**
		 * While a reminder is in hand, picked up, chosen or its night step walked (Trevor,
		 * 2026-10-18): the seat whose character it belongs to (`source`), a seat it may go on
		 * (`target`), or both. A ring, a glow, or the two together, so it never rests on colour
		 * alone. The same marks on the Storyteller's board and a player's grim (Trevor, 2026-11-10).
		 */
		role?: 'source' | 'target' | 'both';
		/** Faded: the reminder in hand doesn't fit this seat (it can still go here). */
		misfit?: boolean;
		/** A reminder is dragged over it, to be let go here. */
		drop?: boolean;
		/** The seat a dragged reminder is being moved from (Trevor, 2026-10-20): a dashed ring. */
		from?: boolean;
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
		notInPlay,
		role,
		misfit = false,
		drop = false,
		from = false
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
	data-not-in-play={notInPlay ? '' : undefined}
	data-framed={framed || undefined}
	data-role={role}
	data-misfit={misfit || undefined}
	data-drop={drop || undefined}
	data-from={from || undefined}
	style:--size="{size}px"
	style:--frame-scale={framed ? 50 / (frame?.faceRadius ?? FACE_RADIUS) : 1}
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
		<!-- The frame's own box, round the face. Laurels and avatars are enough on a seat: no
		     character token over them (Trevor, 2026-11-03). -->
		<span class="frame-box"
			>{#if frame && framed}<span
					class="frame-layer"
					data-growing={growing || undefined}
					onanimationend={() => (growing = false)}><FrameDrawing {frame} /></span
				>{/if}</span
		>
		<!-- Over the face, not in it, so the face's own size never moves the name. -->
		<!-- One name badge for every seat, named or empty (Trevor, 2026-10-19). -->
		<PlayerNameMark {name} />
		{#if dead}<DeadBadge {vote} usedLook={usedVote} testid="dead-mark" />{/if}
		{#if marks}{@render marks()}{/if}
		{#if notInPlay}<span class="not-in-play" data-testid="not-in-play">{notInPlay}</span>{/if}
	</span>
</span>

<style>
	/* What the reminder in hand says about this seat (props `role`, `misfit`, `drop`, `from`). */
	.seat-disc[data-role] .disc,
	.seat-disc[data-from] .disc,
	.seat-disc[data-drop] .disc {
		border-radius: 50%;
	}
	.seat-disc[data-role='source'] .disc,
	.seat-disc[data-role='both'] .disc {
		outline: calc(0.15 * var(--u)) solid var(--accent);
		outline-offset: calc(0.25 * var(--u));
	}
	.seat-disc[data-role='target'] .disc,
	.seat-disc[data-role='both'] .disc {
		box-shadow:
			0 0 0 calc(0.2 * var(--u)) var(--focus-glow),
			0 0 var(--u) calc(0.4 * var(--u)) var(--focus);
	}
	/* Both: the glow sits outside the ring. */
	.seat-disc[data-role='both'] .disc {
		box-shadow:
			0 0 0 calc(0.6 * var(--u)) var(--focus-glow),
			0 0 var(--u) calc(0.8 * var(--u)) var(--focus);
	}
	.seat-disc[data-misfit] .disc {
		opacity: 0.4;
	}
	/* Where the dragged reminder came from, unlike every other seat (Trevor, 2026-10-20). */
	.seat-disc[data-from] .disc {
		outline: calc(0.15 * var(--u)) dashed var(--on-surface);
		outline-offset: calc(0.25 * var(--u));
	}
	.seat-disc[data-drop] .disc {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
	}
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
	/*
	 * The frame's box: the face's circle is the frame's inner circle, so the box reaches past
	 * the token by the frame's width. Unframed, it is the token itself.
	 */
	.frame-box {
		position: absolute;
		inset: calc((1 - var(--frame-scale)) * 50%);
		pointer-events: none;
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
	.seat-disc[data-dead] .frame-layer,
	.seat-disc[data-dead] .face {
		filter: brightness(0.55);
	}
	/* Not in play yet (Trevor, 2026-10-31): greyed, with a pill across the token. */
	.seat-disc[data-not-in-play] .frame-layer,
	.seat-disc[data-not-in-play] .face {
		filter: grayscale(1) brightness(0.6);
	}
	.not-in-play {
		position: absolute;
		inset-inline: -6%;
		top: 50%;
		translate: 0 -50%;
		text-align: center;
		padding: 0.1em 0.4em;
		border-radius: 999em;
		/* The same neutral pill as the player's name under a seat (PlayerNameMark). */
		background: var(--surface-raised);
		border: 1px solid var(--border); /* px-ok: hairline outline */
		color: var(--on-surface);
		font-family: var(--font-player);
		font-weight: 600;
		font-size: calc(var(--size) * 0.14);
		line-height: 1.2;
		white-space: nowrap;
		pointer-events: none;
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
