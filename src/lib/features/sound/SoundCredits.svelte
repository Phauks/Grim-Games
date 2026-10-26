<script lang="ts">
	import { AMBIENCE_MIXES } from '#lib/core/sound/ambience.ts';
</script>

<!-- Where each day and night recording comes from (plan U3). Each is public domain; the NPS
     asks for credit, and the rest are credited the same way, with the recordist when named. -->
<ul class="credits">
	{#each AMBIENCE_MIXES as mix (mix.id)}
		<li>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={mix.page} target="_blank" rel="noopener">{mix.name}, {mix.place}</a>
			<span class="source"
				>{mix.recordist ? `${mix.recordist} · ` : ''}{mix.source} · Public domain</span
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
