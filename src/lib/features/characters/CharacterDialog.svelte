<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { wikiUrl, type Character } from '#lib/core/data/index.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { fly } from 'svelte/transition';
	import { iconUrl } from './icon-url.ts';
	import WikiBox from './WikiBox.svelte';
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
	/** Sections whose bullet points are tips: each becomes a numbered box. */
	const tipLabel = (section: WikiSection) =>
		/^bluffing/i.test(section.heading)
			? 'characters.bluffingTip'
			: /tips/i.test(section.heading)
				? 'characters.tip'
				: undefined;
	let direction = $state(1);
	function go(index: number | undefined) {
		direction = index === undefined ? -1 : 1;
		selected = index;
	}
</script>

{#snippet blocks(section: WikiSection)}
	{@const examples = section.blocks.filter((b) => b.kind === 'example')}
	{@const tip = tipLabel(section)}
	{@const tips = tip ? section.blocks.flatMap((b) => (b.kind === 'list' ? b.items : [])) : []}
	{#each section.blocks as block, j (j)}
		{#if block.kind === 'p'}
			<p><GlossaryText text={block.text} names={[character.name]} /></p>
		{:else if block.kind === 'quote'}
			<p class="quote">{block.text}</p>
		{:else if block.kind === 'artist'}
			<p class="artist">{t('characters.artist', { name: block.name })}</p>
		{:else if block.kind === 'example'}
			<WikiBox label={t('characters.example', { number: examples.indexOf(block) + 1 })}>
				<p><GlossaryText text={block.text} names={[character.name]} /></p>
			</WikiBox>
		{:else if tip}
			{#each block.items as item, k (k)}
				<WikiBox label={t(tip, { number: tips.indexOf(item) + 1 })}>
					<p><GlossaryText text={item} names={[character.name]} /></p>
				</WikiBox>
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
	<!-- Always shown, whichever section is open (Trevor, 2026-10-16). -->
	<header class="character">
		<span class="icon"
			>{#if icon}<img src={icon} alt="" width="64" height="64" />{/if}</span
		>
		<div>
			<p class="type">{typeLabel}</p>
			<p class="ability"><GlossaryText text={character.ability} names={[character.name]} /></p>
		</div>
	</header>
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
								><span>{t('characters.summary')}</span><span class="chevron"
									><Icon name="forward" /></span
								></button
							>
						</li>
						{#each others as section, i (i)}
							<li>
								<button
									type="button"
									aria-current={selected === i ? 'page' : undefined}
									onclick={() => go(i)}
									><span>{label(section)}</span><span class="chevron"><Icon name="forward" /></span
									></button
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
	/* The character stays at the top on every section; only the section text scrolls. */
	.character {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		flex: none;
		padding: var(--space-2) 0 var(--space-3);
		border-bottom: var(--card-border);
	}
	.icon {
		display: inline-grid;
		flex: none;
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
		margin: 0;
		font-family: var(--font-ability);
		font-size: 1.05rem;
		line-height: 1.5;
	}
	.wiki-page {
		line-height: 1.5;
	}
	.wiki-page h3 {
		margin: 0 0 var(--space-2);
		font-size: 1rem;
	}
	.wiki-page p {
		margin: 0 0 var(--space-2);
	}
	.wiki-page ul {
		margin: 0 0 var(--space-2);
		padding-left: var(--space-4);
	}
	/* Phone: Summary, then the list of sections, scrolling together; a section replaces both,
	   with a Back button. */
	.frame {
		flex: 1;
		min-height: 0;
		container-type: inline-size;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: 'pane' 'nav';
		align-content: start;
		gap: var(--space-4);
		height: 100%;
		padding-top: var(--space-3);
		overflow: hidden auto;
		overscroll-behavior: contain;
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
	/* The sections read as navigation, like a document's contents, not as buttons. */
	.nav ul {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: var(--card-border);
	}
	.nav button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-2);
		border: 0;
		border-bottom: var(--card-border);
		border-inline-start: calc(0.2 * var(--u)) solid transparent;
		background: none;
		color: var(--on-surface);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.nav button:hover {
		background: var(--surface-selected);
	}
	.nav button[aria-current] {
		border-inline-start-color: var(--heading);
		color: var(--heading);
		font-weight: 700;
	}
	.chevron {
		display: inline-flex;
		color: var(--on-surface-muted);
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		margin-bottom: var(--space-1);
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font: inherit;
		cursor: pointer;
	}
	/* Wide enough for two readable columns: the contents on the left, the text on the right,
	   each scrolling on its own. */
	@container (min-width: 40rem) {
		.layout:has(.nav) {
			grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
			grid-template-rows: 100%;
			grid-template-areas: 'nav pane';
			overflow: hidden;
		}
		.layout:has(.nav) .nav,
		.layout:has(.nav) .pane {
			overflow: hidden auto;
			overscroll-behavior: contain;
		}
		.layout[data-section] .nav,
		.nav .home {
			display: block;
		}
		.nav ul {
			border-top: 0;
		}
		.nav button {
			border-bottom: 0;
			border-radius: 0 var(--radius-md) var(--radius-md) 0;
		}
		.chevron,
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
