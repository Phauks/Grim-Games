<script lang="ts">
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import AvatarFace from '#lib/ui/seating/AvatarFace.svelte';
	import RimPill from '#lib/ui/seating/RimPill.svelte';
	import type { GuessMark } from './grim-guesses.ts';

	/**
	 * A seat's other guesses on the players' grim, in a pill over the token's top-right rim:
	 * the next guess in the cycle (a character icon, a generic guess, or the player's avatar),
	 * and a "+N" count when more wait behind it (Trevor, 2026-10-29: no cycle arrow, "just tap
	 * on the alternatives"). At most two slots, so it never reaches the next seat or grows as
	 * guesses are added. A tap on the guess makes it the main one; a tap on the count opens
	 * the seat's sheet, which lists every guess (PlayerGrim). The same RimPill as the board's
	 * nominations on the top-left rim. Placed inside SeatDisc's `marks`.
	 */
	interface Props {
		/** The cycle's entries after the front one, in order. */
		others: readonly GuessMark[];
		/**
		 * The rim it sits on: the top right, or the top left on a seat near the grim's right edge,
		 * so it never runs off the screen (Trevor, 2026-10-27).
		 */
		side?: 'left' | 'right';
	}

	let { others, side = 'right' }: Props = $props();
</script>

{#snippet mark(other: GuessMark)}{#if 'character' in other}<img
			class="slot"
			src={iconUrl(other.character)}
			alt={other.character.name}
			data-testid="guess-mark"
		/>{:else if 'avatar' in other}<span
			class="slot"
			data-testid="guess-mark"
			role="img"
			aria-label={other.label}
			><AvatarFace avatar={other.avatar} name={other.name} picture={other.picture} /></span
		>{:else}<span
			class="slot generic"
			data-team={other.generic.team}
			data-testid="guess-mark"
			aria-label={other.label}>{other.label.charAt(0)}</span
		>{/if}{/snippet}

<RimPill {side} testid="guess-marks" title={t('player.grim.nextGuess')}
	>{#if others[0]}{@render mark(others[0])}{/if}{#if others.length > 1}<span
			class="slot more"
			data-testid="more-guesses"
			role="img"
			aria-label={t('player.grim.moreGuesses', { count: others.length - 1 })}
			>+{others.length - 1}</span
		>{/if}</RimPill
>

<style>
	.slot {
		display: grid;
		place-items: center;
		width: var(--slot);
		height: var(--slot);
		border-radius: 50%;
		object-fit: contain;
	}
	.generic {
		font-family: var(--font-control);
		font-size: calc(var(--slot) * 0.6);
		font-weight: 700;
		line-height: 1;
	}
	.generic[data-team='good'] {
		background: var(--good);
		color: var(--on-good);
	}
	.generic[data-team='evil'] {
		background: var(--evil);
		color: var(--on-evil);
	}
	/* Over the pill's own tap target (RimPill), with one of its own: it opens the seat's sheet. */
	.more {
		position: relative;
		z-index: 1;
		color: var(--on-surface);
		font-family: var(--font-control);
		font-size: calc(var(--slot) * 0.5);
		font-weight: 700;
		line-height: 1;
	}
	.more::after {
		content: '';
		position: absolute;
		inset: calc(-0.5 * var(--u));
	}
</style>
