<script lang="ts">
	import type { Snippet } from 'svelte';
	import DeadBadge from './DeadBadge.svelte';
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
	}

	let {
		size,
		dead = false,
		name,
		number,
		face,
		marks,
		vote,
		usedVote = 'hollow'
	}: Props = $props();
</script>

<span class="seat-disc" data-dead={dead || undefined} style:--size="{size}px">
	<span class="disc">
		<span class="face"
			>{#if face}{@render face()}{:else}<span class="empty">{number}</span>{/if}</span
		>
		<!-- Over the face, not in it, so the face's own size never moves the name. -->
		<!-- One name badge for every seat, named or empty (Trevor, 2026-10-19). -->
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
	/* Dead (Trevor, 2026-10-16): the token dimmed, colour kept, plus a skull badge. */
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
	}
</style>
