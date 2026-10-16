<script lang="ts">
	import { wikiUrl, type Character } from '#lib/core/data/index.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { iconUrl } from './icon-url.ts';
	import { wikiPageTitle, type WikiSection } from './wiki-page.ts';
	import { wikiPages } from './wiki-page.svelte.ts';

	interface Props {
		open?: boolean;
		character: Character;
		icon?: string;
	}

	let { open = $bindable(false), character, icon: given }: Props = $props();
	// Callers may pass the seat's icon (its alignment); otherwise the character's own.
	const icon = $derived(given ?? iconUrl(character));
	const wiki = $derived(wikiUrl(character));
	const typeLabel = $derived(character.type[0].toUpperCase() + character.type.slice(1));
	// The whole wiki page, fetched live when the dialog opens (wiki-page.svelte.ts).
	const title = $derived(wiki ? wikiPageTitle(wiki) : undefined);
	const page = $derived(title ? wikiPages.get(title) : undefined);
	$effect(() => {
		if (open && title) void wikiPages.load(title);
	});

	// Only the Summary shows; every other section is a button that opens it on its own, so the
	// dialog isn't overloaded (Trevor, 2026-10-16). Without a "Summary" heading, the first section.
	const sections = $derived(page?.status === 'ready' ? page.sections : []);
	const summaryIndex = $derived(
		Math.max(
			0,
			sections.findIndex((s) => s.heading.trim().toLowerCase() === 'summary')
		)
	);
	const summary = $derived(sections[summaryIndex]);
	const others = $derived(sections.filter((_, i) => i !== summaryIndex));
	let shown = $state<WikiSection>();
	let sectionOpen = $state(false);
</script>

{#snippet blocks(section: WikiSection)}
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
{/snippet}

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
				{#if summary}
					{#if summary.heading}<h3>{summary.heading}</h3>{/if}
					{@render blocks(summary)}
				{/if}
				{#if others.length}
					<ul class="more" aria-label="More from the wiki">
						{#each others as section, i (i)}
							<li>
								<button
									type="button"
									onclick={() => {
										shown = section;
										sectionOpen = true;
									}}>{section.heading || 'Introduction'}</button
								>
							</li>
						{/each}
					</ul>
				{/if}
			{:else if page.status === 'loading'}
				<p class="muted">Loading the wiki page…</p>
			{:else}
				<p class="muted">The wiki page can't be loaded right now. Open it with the button below.</p>
			{/if}
		</section>
	{/if}
	{#snippet headActions()}
		{#if wiki}
			<!-- External wiki page (the rules authority), not an app route. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				class="wiki"
				href={wiki}
				target="_blank"
				rel="noopener"
				aria-label="Open wiki"
				title="Open wiki"
			>
				<Icon name="wiki" />
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{:else}
			<!-- Homebrew: no wiki page. Shown disabled so the header is the same for every character. -->
			<span class="wiki" role="img" aria-label="No wiki entry" title="No wiki entry" data-disabled
				><Icon name="wiki" /></span
			>
		{/if}
	{/snippet}
</Dialog>

{#if shown}
	<Dialog bind:open={sectionOpen} title="{character.name}: {shown.heading || 'Introduction'}">
		<section class="wiki-page" data-testid="wiki-section">{@render blocks(shown)}</section>
	</Dialog>
{/if}

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
	.wiki-page .more {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2, calc(0.5 * var(--u)));
		margin: var(--space-3, calc(0.75 * var(--u))) 0 0;
		padding: 0;
		list-style: none;
	}
	.more button {
		min-height: var(--tap-target);
		padding: 0 var(--space-3, calc(0.75 * var(--u)));
		border: var(--card-border, 1px solid var(--border));
		border-radius: var(--radius-full, 999px);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		cursor: pointer;
	}
	.more button:hover {
		background: var(--surface-selected);
	}
	.muted {
		color: var(--on-surface-muted);
	}
	.wiki {
		display: grid;
		place-items: center;
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		border-radius: var(--radius-md, calc(0.5 * var(--u)));
		color: inherit;
		text-decoration: none;
	}
	a.wiki:hover {
		background: var(--surface-selected);
	}
	.wiki[data-disabled] {
		opacity: 0.4;
	}
</style>
