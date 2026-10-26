<script lang="ts">
	import { AMBIENCE_CREDITS } from '#lib/core/sound/ambience.ts';
</script>

<!-- Where each day and night recording comes from (plan U3). Each is public domain or CC0; the
     NPS asks for credit, and the rest are credited the same way. -->
<ul class="credits">
	{#each AMBIENCE_CREDITS as credit (credit.file)}
		<li>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={credit.page} target="_blank" rel="noopener">{credit.title}</a>
			<span class="source">{credit.source} · {credit.licence}</span>
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
