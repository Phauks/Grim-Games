<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import AlignmentPill from '#lib/features/grimoire/AlignmentPill.svelte';
	import type { GenericGuess } from './grim-guesses.ts';

	/**
	 * The guess sheet's row of generic guesses on the player's Grim: a seat by its character type
	 * alone, or only good or evil (Trevor, 2026-10-24). A tap adds or takes off that guess.
	 */
	let {
		choices,
		label,
		pressed,
		onGuess
	}: {
		choices: readonly GenericGuess[];
		label: (g: GenericGuess) => string;
		pressed: (key: string) => boolean;
		onGuess: (key: string) => void;
	} = $props();
</script>

<ul class="generic" aria-label={t('player.grim.generic')}>
	{#each choices as g (g.key)}
		<li>
			<button
				type="button"
				aria-pressed={pressed(g.key)}
				data-guess-key={g.key}
				onclick={() => onGuess(g.key)}><AlignmentPill alignment={g.team} text={label(g)} /></button
			>
		</li>
	{/each}
</ul>

<style>
	.generic {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(30%, calc(7 * var(--u))), 1fr));
		gap: var(--space-1);
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
	}
	.generic button {
		display: grid;
		place-items: center;
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-1);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		font: inherit;
		touch-action: manipulation;
		cursor: pointer;
	}
	.generic button[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--surface-selected);
	}
</style>
