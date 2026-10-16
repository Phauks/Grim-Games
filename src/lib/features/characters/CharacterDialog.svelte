<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { wikiUrl, type Character } from '#lib/core/data/index.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { fly } from 'svelte/transition';
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

	// The Summary first; every other wiki section is one tap away, so the dialog isn't
	// overloaded (Trevor, 2026-10-16). Wide dialogs show the list of sections beside the text;
	// on a phone the list sits under the Summary and a section slides in over it. Without a
	// "Summary" heading, the first section is the summary.
	const sections = $derived(page?.status === 'ready' ? page.sections : []);
	const summaryIndex = $derived(
		Math.max(
			0,
			sections.findIndex((s) => s.heading.trim().toLowerCase() === 'summary')
		)
	);
	const summary = $derived(sections[summaryIndex]);
	const others = $derived(sections.filter((_, i) => i !== summaryIndex));
	/** The section shown instead of the Summary, by its place in `others`. */
	let selected = $state<number>();
	const shown = $derived(selected === undefined ? undefined : others[selected]);
	// Back to the Summary whenever the dialog opens again or shows another character.
	$effect(() => {
		void character.id;
		if (!open) selected = undefined;
	});
	const reduceMotion =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	let width = $state(0);
	/** Two panes from 40rem of dialog width (the container query below), so nothing slides. */
	const slides = $derived(
		!reduceMotion &&
			width > 0 &&
			width < 40 * parseFloat(getComputedStyle(document.documentElement).fontSize)
	);
	const label = (section: WikiSection) => section.heading || t('characters.wikiIntroduction');
	const isTips = (section: WikiSection) => /tips/i.test(section.heading);
	let direction = $state(1);
	function go(index: number | undefined) {
		direction = index === undefined ? -1 : 1;
		selected = index;
	}
</script>

{#snippet blocks(section: WikiSection)}
	{@const examples = section.blocks.filter((b) => b.kind === 'example')}
	{#each section.blocks as block, j (j)}
		{#if block.kind === 'p'}
			<p><GlossaryText text={block.text} names={[character.name]} /></p>
		{:else if block.kind === 'quote'}
			<p class="quote">{block.text}</p>
		{:else if block.kind === 'artist'}
			<p class="artist">{t('characters.artist', { name: block.name })}</p>
		{:else if block.kind === 'example'}
			<section class="box example">
				<h4>{t('characters.example', { number: examples.indexOf(block) + 1 })}</h4>
				<p><GlossaryText text={block.text} names={[character.name]} /></p>
			</section>
		{:else if isTips(section)}
			{#each block.items as item, k (k)}
				<p class="box tip"><GlossaryText text={item} names={[character.name]} /></p>
			{/each}
		{:else}
			<ul>
				{#each block.items as item, k (k)}
					<li><GlossaryText text={item} names={[character.name]} /></li>
				{/each}
			</ul>
		{/if}
	{/each}
{/snippet}

<Dialog bind:open title={character.name} size="full">
	<div class="frame" bind:clientWidth={width}>
		<div class="layout" data-section={shown ? '' : undefined}>
			{#if others.length}
				<nav class="nav" aria-label={t('characters.moreFromWiki')}>
					<ul>
						<li class="home">
							<button
								type="button"
								aria-current={shown ? undefined : 'page'}
								onclick={() => go(undefined)}
								><span>{t('characters.summary')}</span><Icon name="forward" /></button
							>
						</li>
						{#each others as section, i (i)}
							<li>
								<button
									type="button"
									aria-current={selected === i ? 'page' : undefined}
									onclick={() => go(i)}><span>{label(section)}</span><Icon name="forward" /></button
								>
							</li>
						{/each}
					</ul>
				</nav>
			{/if}
			<div class="pane">
				{#key shown}
					<div class="view" in:fly={{ x: slides ? direction * 48 : 0, duration: slides ? 200 : 0 }}>
						{#if shown}
							<button type="button" class="back" onclick={() => go(undefined)}
								><Icon name="back" /><span>{t('characters.summary')}</span></button
							>
							<!-- The wiki's own page, word for word (never bundled; see wiki-page.svelte.ts). -->
							<section class="wiki-page" data-testid="wiki-section" aria-label={label(shown)}>
								<h3>{label(shown)}</h3>
								{@render blocks(shown)}
							</section>
						{:else}
							<div class="summary">
								<span class="icon"
									>{#if icon}<img src={icon} alt="" width="64" height="64" />{/if}</span
								>
								<p class="type">{typeLabel}</p>
							</div>
							<p class="ability">
								<GlossaryText text={character.ability} names={[character.name]} />
							</p>
							{#if page}
								<section
									class="wiki-page"
									aria-label={t('characters.wikiPage')}
									data-testid="wiki-page"
								>
									{#if page.status === 'ready'}
										{#if summary}
											{#if summary.heading}<h3>{summary.heading}</h3>{/if}
											{@render blocks(summary)}
										{/if}
									{:else if page.status === 'loading'}
										<p class="muted">{t('characters.wikiLoading')}</p>
									{:else}
										<p class="muted">{t('characters.wikiFailed')}</p>
									{/if}
								</section>
							{/if}
						{/if}
					</div>
				{/key}
			</div>
		</div>
	</div>
	{#snippet headActions()}
		{#if wiki}
			<!-- External wiki page (the rules authority), not an app route. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				class="wiki"
				href={wiki}
				target="_blank"
				rel="noopener"
				aria-label={t('characters.openWiki')}
				title={t('characters.openWiki')}
			>
				<Icon name="wiki" />
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{:else}
			<!-- Homebrew: no wiki page. Shown disabled so the header is the same for every character. -->
			<span
				class="wiki"
				role="img"
				aria-label={t('characters.noWiki')}
				title={t('characters.noWiki')}
				data-disabled><Icon name="wiki" /></span
			>
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
	/* Phone: Summary, then the list of sections; a section replaces both, with a Back button. */
	.frame {
		container-type: inline-size;
		overflow-x: clip;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: 'pane' 'nav';
		gap: var(--space-4, calc(1 * var(--u)));
	}
	.pane {
		grid-area: pane;
		min-width: 0;
	}
	.nav {
		grid-area: nav;
	}
	.layout[data-section] .nav,
	.nav .home {
		display: none;
	}
	.nav ul {
		display: grid;
		gap: var(--space-2, calc(0.5 * var(--u)));
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.nav button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2, calc(0.5 * var(--u)));
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-3, calc(0.75 * var(--u)));
		border: var(--card-border, 1px solid var(--border));
		border-radius: var(--radius-md, calc(0.5 * var(--u)));
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.nav button:hover,
	.nav button[aria-current] {
		background: var(--surface-selected);
	}
	.nav button[aria-current] {
		font-weight: 700;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1, calc(0.25 * var(--u)));
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font: inherit;
		cursor: pointer;
	}
	/* Wide enough for two readable columns: the sections on the left, the text on the right. */
	@container (min-width: 40rem) {
		.layout:has(.nav) {
			grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
			grid-template-areas: 'nav pane';
			align-items: start;
		}
		.layout[data-section] .nav,
		.nav .home {
			display: block;
		}
		.back {
			display: none;
		}
	}
	.wiki-page .quote {
		font-style: italic;
	}
	.wiki-page .artist {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.box {
		margin: 0 0 var(--space-3, calc(0.75 * var(--u)));
		padding: var(--space-3, calc(0.75 * var(--u)));
		border: var(--card-border, 1px solid var(--border));
		border-radius: var(--radius-md, calc(0.5 * var(--u)));
		background: var(--surface-raised);
	}
	.box p {
		margin: 0;
	}
	.example h4 {
		margin: 0 0 var(--space-1, calc(0.25 * var(--u)));
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	.tip {
		border-inline-start: 0.25rem solid var(--heading);
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
