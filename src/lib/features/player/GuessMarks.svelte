<script lang="ts">
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import AvatarFace from '#lib/ui/seating/AvatarFace.svelte';
	import RimPill from '#lib/ui/seating/RimPill.svelte';
	import type { GuessMark } from './grim-guesses.ts';

	/**
	 * A seat's other guesses on the players' grim (Trevor, 2026-10-25: "a guess on the token,
	 * an arrow to cycle, and above it to the top right, you see the different icons for the
	 * characters"): one small icon each, or the player's avatar once it is in the cycle, in a pill over the token's top-right rim, then the
	 * arrow. The same RimPill as the board's nominations on the top-left rim; the note keeps the
	 * lower right and the skull the lower left. The whole pill is one tap target: tapping it
	 * makes the next guess the main one (PlayerGrim). Placed inside SeatDisc's `marks`.
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

<RimPill {side} testid="guess-marks" title={t('player.grim.nextGuess')}
	>{#each others as other, i (i)}{#if 'character' in other}<img
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
			>{/if}{/each}<span class="slot next"><Icon name="nextGuess" /></span></RimPill
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
	.next {
		color: var(--on-surface);
		--icon-size: calc(var(--slot) * 0.7);
	}
</style>
