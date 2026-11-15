<script lang="ts">
	import { fitWords } from '#lib/ui/fit-words.ts';
	import TokenFace from '#lib/ui/token/TokenFace.svelte';
	import type { GenericGuess } from './grim-guesses.ts';

	/**
	 * A player's guess of a seat by its character type or alignment alone (Trevor, 2026-10-24:
	 * "a generic minion, demon, outsider, or townsfolk", "or just good or evil"): a blank token
	 * with the word across its middle, in its alignment's colour. Beside other guesses in a split
	 * seat it is the word alone, with no token round it, as a character there is its icon alone
	 * (Trevor, 2026-11-14).
	 */
	interface Props {
		guess: GenericGuess;
		label: string;
		size: number;
		/** The blank token behind the word; off, the word alone fills `size`. */
		face?: boolean;
	}

	let { guess, label, size, face = true }: Props = $props();
</script>

<span
	class="generic"
	class:bare={!face}
	data-team={guess.team}
	style:--token-size="{size}px"
	role={face ? undefined : 'img'}
	aria-label={face ? undefined : label}
>
	{#if face}<TokenFace
			{label}
			leaves={{ firstNight: false, otherNight: false, reminders: 0 }}
			{size}
		/>{/if}
	<span class="room"
		><span class="word" aria-hidden="true" {@attach fitWords(label)}>{label}</span></span
	>
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
	/* The word fits the token whole, shrunk as a long one needs (fitWords: "Outsider" was cut
	   to "Outsi…", 2026-10-28). Safe centring lets an overlong word run off to the right only,
	   so it is measured against the whole room. */
	.room {
		position: relative;
		z-index: var(--z-above);
		display: flex;
		justify-content: safe center;
		width: 84%;
	}
	.word {
		padding: 0 0.3em;
		border-radius: var(--radius-full);
		font-family: var(--font-control);
		font-size: calc(var(--token-size) * 0.16 * var(--fit, 1));
		font-weight: 700;
		line-height: 1.3;
		white-space: nowrap;
	}
	/* The word alone, inside the room an icon in its place would have, shrunk to fit it. */
	.bare .room {
		width: 80%;
	}
	.bare .word {
		font-size: calc(var(--token-size) * 0.17 * var(--fit, 1));
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
