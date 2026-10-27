<script lang="ts">
	import { AMBIENCE_MIXES } from '#lib/core/sound/ambience.ts';
	import { BOARD_SOUNDS } from '#lib/core/sound/soundboard.ts';

	/** Each recording with what the credit names: day and night sound, then the soundboard. */
	const credits = [
		...AMBIENCE_MIXES.map((mix) => ({ ...mix, licence: 'Public domain' })),
		...BOARD_SOUNDS
	];
</script>

<!-- Where each recording comes from (plans U3 and U6). Each is public domain or CC0; the NPS
     asks for credit, and the rest are credited the same way, with the recordist when named. -->
<ul class="credits">
	{#each credits as credit (credit.id)}
		<li>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={credit.page} target="_blank" rel="noopener"
				>{credit.place ? `${credit.name}, ${credit.place}` : credit.name}</a
			>
			<span class="source"
				>{credit.recordist ? `${credit.recordist} · ` : ''}{credit.source} · {credit.licence}</span
			>
		</li>
	{/each}
</ul>

<style>
	.credits {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0 var(--space-2);
		padding-block: var(--space-2);
	}
	li + li {
		border-top: 1px solid var(--border);
	}
	a {
		color: inherit;
	}
	.source {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
</style>
