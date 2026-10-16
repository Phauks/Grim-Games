<script lang="ts">
	import { wikiUrl, type Character } from '#lib/core/data/index.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { wikiPageTitle } from './wiki-page.ts';
	import { wikiPages } from './wiki-page.svelte.ts';

	interface Props {
		open?: boolean;
		character: Character;
		icon?: string;
	}

	let { open = $bindable(false), character, icon }: Props = $props();
	const wiki = $derived(wikiUrl(character));
	const typeLabel = $derived(character.type[0].toUpperCase() + character.type.slice(1));
	// The whole wiki page, fetched live when the dialog opens (wiki-page.svelte.ts).
	const title = $derived(wiki ? wikiPageTitle(wiki) : undefined);
	const page = $derived(title ? wikiPages.get(title) : undefined);
	$effect(() => {
		if (open && title) void wikiPages.load(title);
	});
</script>

<Dialog bind:open title={character.name}>
	<div class="summary">
		<span class="icon"
			>{#if icon}<img src={icon} alt="" width="64" height="64" />{/if}</span
		>
		<p class="type">{typeLabel}</p>
	</div>
	<p class="ability"><GlossaryText text={character.ability} names={[character.name]} /></p>
	{#if page}
		<!-- The wiki's own page, word for word (never bundled; see wiki-page.svelte.ts). -->
		<section class="wiki-page" aria-label="Wiki page" data-testid="wiki-page">
			{#if page.status === 'ready'}
				{#each page.sections as section, i (i)}
					{#if section.heading}<h3>{section.heading}</h3>{/if}
					{#each section.blocks as block, j (j)}
						{#if block.kind === 'p'}
							<p><GlossaryText text={block.text} names={[character.name]} /></p>
						{:else}
							<ul>
								{#each block.items as item, k (k)}
									<li><GlossaryText text={item} names={[character.name]} /></li>
								{/each}
							</ul>
						{/if}
					{/each}
				{/each}
			{:else if page.status === 'loading'}
				<p class="muted">Loading the wiki page…</p>
			{:else}
				<p class="muted">The wiki page can't be loaded right now. Open it with the button below.</p>
			{/if}
		</section>
	{/if}
	{#snippet actions()}
		{#if wiki}
			<!-- External wiki page (the rules authority), not an app route. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="wiki" href={wiki} target="_blank" rel="noopener">
				<Icon name="wiki" /><span>Open wiki entry</span>
			</a>
		{:else}
			<!-- Homebrew: no wiki page. Shown disabled so the layout is the same for every character. -->
			<span class="wiki" aria-disabled="true"><Icon name="wiki" /><span>No wiki entry</span></span>
		{/if}
	{/snippet}
</Dialog>

<style>
	.summary {
		display: flex;
		align-items: center;
		gap: var(--space-3, calc(0.75 * var(--u)));
	}
	.icon {
		display: inline-grid;
		place-items: center;
		width: calc(4.5 * var(--u));
		height: calc(4.5 * var(--u));
		border-radius: 50%;
		background: var(--token-face, var(--on-surface));
	}
	.type {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.ability {
		font-family: var(--font-ability);
		font-size: 1.05rem;
		line-height: 1.5;
	}
	.wiki-page {
		line-height: 1.5;
	}
	.wiki-page h3 {
		margin: var(--space-4, calc(1 * var(--u))) 0 var(--space-1, calc(0.25 * var(--u)));
		font-size: 1rem;
	}
	.wiki-page p {
		margin: 0 0 var(--space-2, calc(0.5 * var(--u)));
	}
	.wiki-page ul {
		margin: 0 0 var(--space-2, calc(0.5 * var(--u)));
		padding-left: var(--space-4, calc(1 * var(--u)));
	}
	.muted {
		color: var(--on-surface-muted);
	}
	.wiki {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2, calc(0.5 * var(--u)));
		min-height: var(--tap-target);
		padding: 0 var(--space-4, calc(1 * var(--u)));
		border-radius: var(--radius-md, calc(0.5 * var(--u)));
		background: var(--accent);
		color: var(--on-accent, var(--on-surface));
		text-decoration: none;
		font-weight: 600;
	}
	.wiki[aria-disabled='true'] {
		opacity: 0.5;
	}
</style>
