<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
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
		/** Which side of the token the name goes, so nothing covers it. */
		namePlace?: 'below' | 'above' | 'left' | 'right';
		face?: Snippet;
		/** Marks drawn over or around the token (notes, extra claims, warnings). */
		marks?: Snippet;
		/**
		 * A dead player's ghost vote, shown on the skull badge (Trevor, 2026-10-19: one badge
		 * for both): filled while it is still there, hollow once used.
		 */
		vote?: 'unused' | 'used';
	}

	let {
		size,
		dead = false,
		name,
		number,
		namePlace = 'below',
		face,
		marks,
		vote
	}: Props = $props();

	/** The player's name is a badge on the token (Trevor, 2026-10-17); a seat with no character keeps the pill under it. */
	const onToken = $derived(face !== undefined);
</script>

<span class="seat-disc" data-dead={dead || undefined} style:--size="{size}px">
	<span class="disc">
		<span class="face"
			>{#if face}{@render face()}{:else}<span class="empty">{number}</span>{/if}</span
		>
		<!-- Over the face, not in it, so the face's own size never moves the name. -->
		{#if onToken}<PlayerNameMark {name} />{/if}
		{#if dead}<span class="skull" data-testid="dead-mark" data-vote={vote}
				><Icon name="dead" /></span
			>{/if}
		{#if marks}{@render marks()}{/if}
	</span>
	{#if !onToken}<span class="name" data-place={namePlace}>{name}</span>{/if}
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
	/* One skull badge on the lower-left rim, half outside the token. */
	.skull {
		position: absolute;
		left: -10%;
		bottom: -6%;
		display: grid;
		place-items: center;
		width: calc(var(--size) * 0.38);
		height: calc(var(--size) * 0.38);
		border: calc(0.125 * var(--u)) solid var(--on-button);
		border-radius: 50%;
		background: var(--button);
		color: var(--on-button);
		box-shadow: var(--shadow);
		--icon-size: calc(var(--size) * 0.26);
	}
	/* The ghost vote spent: the badge goes hollow, like a vote token taken away. */
	.skull[data-vote='used'] {
		border-color: var(--on-surface-muted);
		background: var(--surface);
		color: var(--on-surface-muted);
	}
	/*
	 * The player's name in its own badge (Trevor, 2026-10-16), neutral so it never reads as
	 * a team, and readable on any background. Beneath the token unless that is covered;
	 * a long name is cut short rather than widening the seat.
	 */
	.name {
		position: absolute;
		box-sizing: border-box;
		max-width: 100%;
		overflow: hidden;
		padding: 0.15em 0.5em;
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface);
		box-shadow: var(--shadow);
		font-family: var(--font-player);
		font-size: calc(0.8rem * var(--name-scale, 1));
		line-height: 1.2;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.name[data-place='below'] {
		top: calc(100% + 0.125 * var(--u));
		left: 50%;
		translate: -50% 0;
	}
	.name[data-place='above'] {
		bottom: calc(100% + 0.125 * var(--u));
		left: 50%;
		translate: -50% 0;
	}
	.name[data-place='left'],
	.name[data-place='right'] {
		top: 50%;
		translate: 0 -50%;
	}
	.name[data-place='left'] {
		right: calc(50% + var(--size) / 2 + 0.125 * var(--u));
	}
	.name[data-place='right'] {
		left: calc(50% + var(--size) / 2 + 0.125 * var(--u));
	}
	@media (prefers-reduced-motion: reduce) {
		.face {
			transition: none;
		}
	}
</style>
