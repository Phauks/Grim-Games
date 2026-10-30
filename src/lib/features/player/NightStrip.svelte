<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import MarkerToken from '#lib/ui/token/MarkerToken.svelte';
	import type { PlayerNight } from './player-script.ts';

	/**
	 * One night's order as a column of icons, for the printed front: players see when they
	 * wake without turning the sheet over (idea from Ravenswood Studio's script sheets,
	 * reimplemented; Trevor, 2026-10-19).
	 */
	interface Props {
		night: PlayerNight;
	}

	let { night }: Props = $props();
</script>

<section class="strip" data-night-strip={night.night}>
	<h2>{night.night === 'first' ? t('player.firstNight') : t('player.otherNights')}</h2>
	<ol>
		{#each night.entries as entry, i (i)}
			<li data-step={entry.kind === 'marker' ? entry.id : entry.character.id}>
				{#if entry.kind === 'marker'}
					<MarkerToken marker={entry.id} size={48} label="" />
				{:else}
					<CharacterToken character={entry.character} size={48} />
				{/if}
			</li>
		{/each}
	</ol>
</section>

<style>
	.strip {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		/* The printed front's Icon size scales it (--character-ring-scale). */
		width: calc(9mm * var(--character-ring-scale, 1));
	}
	h2 {
		margin: 0;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		font-size: 0.7rem;
		white-space: nowrap;
		color: var(--heading);
	}
	ol {
		display: grid;
		gap: 0.5mm;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		width: calc(8mm * var(--character-ring-scale, 1));
		height: calc(8mm * var(--character-ring-scale, 1));
	}
	/* The tokens' own size is a fixed px; here they fill their slot. */
	.strip li :global(> *) {
		width: 100%;
		height: 100%;
	}
</style>
