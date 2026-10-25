<script lang="ts">
	import TokenFace from '#lib/ui/token/TokenFace.svelte';
	import type { GenericGuess } from './grim-guesses.ts';

	/**
	 * A player's guess of a seat by its character type or alignment alone (Trevor, 2026-10-24:
	 * "a generic minion, demon, outsider, or townsfolk", "or just good or evil"): a blank token
	 * with the word across its middle, in its alignment's colour.
	 */
	interface Props {
		guess: GenericGuess;
		label: string;
		size: number;
	}

	let { guess, label, size }: Props = $props();
</script>

<span class="generic" data-team={guess.team} style:--token-size="{size}px">
	<TokenFace {label} leaves={{ firstNight: false, otherNight: false, reminders: 0 }} {size} />
	<span class="word" aria-hidden="true">{label}</span>
</span>

<style>
	.generic {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: var(--token-size);
		height: var(--token-size);
	}
	.generic > :global(*) {
		grid-area: 1 / 1;
	}
	/* The word fits the token: about a fifth of its width per line. */
	.word {
		position: relative;
		z-index: 1;
		max-width: 80%;
		padding: 0 0.3em;
		border-radius: var(--radius-full);
		font-family: var(--font-control);
		font-size: calc(var(--token-size) * 0.16);
		font-weight: 700;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.generic[data-team='good'] .word {
		background: var(--good);
		color: var(--on-good);
	}
	.generic[data-team='evil'] .word {
		background: var(--evil);
		color: var(--on-evil);
	}
</style>
