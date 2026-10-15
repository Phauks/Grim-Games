<script lang="ts">
	import { RELEASES, releaseSections } from '#lib/features/about/changelog.ts';
</script>

<svelte:head>
	<title>Changelog · Grim-Games</title>
</svelte:head>

<main>
	<h1>Changelog</h1>
	{#each RELEASES as release (release.version)}
		<section aria-labelledby="release-{release.version ?? 'unreleased'}">
			<h2 id="release-{release.version ?? 'unreleased'}">
				{release.version ? `v${release.version}` : 'Unreleased'}
				{#if release.date}<span class="date">{release.date}</span>{/if}
			</h2>
			{#each releaseSections(release) as { category, items } (category)}
				<h3>{category}</h3>
				{#if items.length}
					<ul>
						{#each items as item, i (i)}<li>{item}</li>{/each}
					</ul>
				{:else}
					<p class="none">None</p>
				{/if}
			{/each}
		</section>
	{/each}
</main>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
	h1 {
		margin-top: 0;
		font-size: 1.6rem;
	}
	h2 {
		margin: var(--space-4) 0 var(--space-2);
		font-size: 1.2rem;
	}
	.date {
		margin-left: var(--space-2);
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	h3 {
		margin: var(--space-3) 0 var(--space-1);
		font-size: 1rem;
	}
	ul,
	p {
		margin: 0;
	}
	.none {
		color: var(--on-surface-muted);
	}
</style>
