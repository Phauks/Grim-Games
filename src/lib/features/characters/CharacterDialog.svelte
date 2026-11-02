<script lang="ts">
	import { tick } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { wikiUrl, type Alignment, type Character } from '#lib/core/data/index.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import { explainBlock } from '#lib/features/glossary/glossary.svelte.ts';
	import { clearTermHandler } from '#lib/features/glossary/term-handler.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { jinxesFor } from '#lib/core/data/jinxes.ts';
	import CharacterEntry from './CharacterEntry.svelte';
	import { officialData } from './game-data.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ContentsLayout, { type ContentsItem } from '#lib/ui/layout/ContentsLayout.svelte';
	import CharacterSummary from './CharacterSummary.svelte';
	import WikiBox from './WikiBox.svelte';
	import { wikiPageTitle, withoutRepeats, type WikiSection } from './wiki-page.ts';
	import { wikiPages } from './wiki-page.svelte.ts';
	import { provideShownCharacter } from './character-context.ts';

	interface Props {
		open?: boolean;
		character: Character;
		icon?: string;
		/**
		 * The page of a character with no BotC wiki page (a homebrew one): where it came from,
		 * such as its Homebrew Wiki page (Script builder, Trevor 2026-10-18). Opened by the
		 * header's link in its place.
		 */
		sourcePage?: string;
		/** The seat it was opened from (CharacterSummary). */
		seat?: { number: number; alignment?: Alignment };
	}

	let { open = $bindable(false), character, icon: given, sourcePage, seat }: Props = $props();
	// Terms here open their popover, even when these details were opened from the Glossary.
	clearTermHandler();
	// Its own badge in the text draws the eye back to the summary at the top (Trevor, 2026-10-20).
	let summaryEl = $state<HTMLElement>();
	let pulse = $state(false);
	provideShownCharacter({
		id: () => character.id,
		focus: async () => {
			// Off for a frame first, so a second tap while it shows starts it again.
			pulse = false;
			await tick();
			void summaryEl?.offsetWidth;
			pulse = true;
			summaryEl?.scrollIntoView({ block: 'nearest' });
		}
	});
	const wiki = $derived(wikiUrl(character));
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
	// Without what the header already says (the ability) or the Bluffing lead-in.
	const sections = $derived(
		page?.status === 'ready'
			? page.sections.map((section) => withoutRepeats(section, character.ability))
			: []
	);
	const summaryIndex = $derived(
		Math.max(
			0,
			sections.findIndex((s) => s.heading.trim().toLowerCase() === 'summary')
		)
	);
	const summary = $derived(sections[summaryIndex]);
	// The wiki's own jinx list ("Related Jinxes") is left out: Jinxes shows all of TPI's.
	const others = $derived(
		sections.filter((s, i) => i !== summaryIndex && !/jinx/i.test(s.heading))
	);
	/** Every TPI jinx with this character, not only those on the current script. */
	const jinxes = $derived(
		officialData.current ? jinxesFor(officialData.current.jinxes, character.id) : []
	);
	/** The section shown instead of the Summary, by its place in `others`. */
	let selected = $state<number | 'jinxes'>();
	const shown = $derived(typeof selected === 'number' ? others[selected] : undefined);
	// Back to the Summary whenever the dialog opens again or shows another character.
	$effect(() => {
		void character.id;
		if (!open) selected = undefined;
	});
	const label = (section: WikiSection) => section.heading || t('characters.wikiIntroduction');
	const isExamples = (section: WikiSection) => /^examples?$/i.test(section.heading.trim());
	/** Sections whose bullet points are tips: each becomes a numbered box. */
	const tipLabel = (section: WikiSection) =>
		/^bluffing/i.test(section.heading)
			? 'characters.bluffingTip'
			: // Minions' and Demons' "Fighting the …" tips, boxed like the others (Trevor, 2026-10-18).
				/^fighting/i.test(section.heading)
				? 'characters.fightingTip'
				: /tips/i.test(section.heading)
					? 'characters.tip'
					: undefined;
	/**
	 * How many tips or examples a section holds, shown beside it in the list like the
	 * Jinxes' count (Trevor, 2026-10-20); sections of plain text have none.
	 */
	function countOf(section: WikiSection): number | undefined {
		if (isExamples(section)) return section.blocks.filter((b) => b.kind === 'example').length;
		if (tipLabel(section))
			return section.blocks.reduce((n, b) => n + (b.kind === 'list' ? b.items.length : 0), 0);
		return undefined;
	}
	const items = $derived<ContentsItem[]>([
		{ id: 'summary', label: t('characters.summary'), wideOnly: true },
		{ id: 'jinxes', label: t('characters.jinxes'), count: jinxes.length },
		...others.map((section, i) => ({
			id: String(i),
			label: label(section),
			count: countOf(section)
		}))
	]);
	const current = $derived(
		selected === undefined ? 'summary' : selected === 'jinxes' ? 'jinxes' : String(selected)
	);
	/**
	 * A section's text with each rules term underlined at its first use in the whole section,
	 * not again in every paragraph or bullet (Trevor, 2026-11-02; Wikipedia's "link once",
	 * MOS:DUPLINK). One list of pieces per block, and per item of a list.
	 */
	function marked(section: WikiSection) {
		const texts = section.blocks.map((b) =>
			b.kind === 'list' ? b.items : b.kind === 'p' || b.kind === 'example' ? [b.text] : []
		);
		const all = explainBlock(texts.flat(), [character.name]);
		let at = 0;
		return texts.map((t) => all.slice(at, (at += t.length)));
	}
	function go(id: string) {
		selected = id === 'summary' ? undefined : id === 'jinxes' ? 'jinxes' : Number(id);
	}
</script>

{#snippet blocks(section: WikiSection)}
	{@const examples = section.blocks.filter((b) => b.kind === 'example')}
	{@const tip = tipLabel(section)}
	{@const tips = tip ? section.blocks.flatMap((b) => (b.kind === 'list' ? b.items : [])) : []}
	{@const parts = marked(section)}
	{#each section.blocks as block, j (j)}
		{#if block.kind === 'p'}
			<p><GlossaryText segments={parts[j][0] ?? []} /></p>
		{:else if block.kind === 'quote'}
			<p class="quote">{block.text}</p>
		{:else if block.kind === 'artist'}
			<p class="artist">{t('characters.artist', { name: block.name })}</p>
		{:else if block.kind === 'example' && !isExamples(section)}
			<!-- The wiki marks worked steps in How to Run the same way; only Examples are boxed. -->
			<p><GlossaryText segments={parts[j][0] ?? []} /></p>
		{:else if block.kind === 'example'}
			<WikiBox label={t('characters.example', { number: examples.indexOf(block) + 1 })}>
				<p><GlossaryText segments={parts[j][0] ?? []} /></p>
			</WikiBox>
		{:else if tip}
			{#each block.items as item, k (k)}
				<WikiBox label={t(tip, { number: tips.indexOf(item) + 1 })}>
					<p><GlossaryText segments={parts[j][k] ?? []} /></p>
				</WikiBox>
			{/each}
		{:else}
			<ul>
				{#each parts[j] as segments, k (k)}
					<li><GlossaryText {segments} /></li>
				{/each}
			</ul>
		{/if}
	{/each}
{/snippet}

<!-- eslint-disable-next-line grim/names-as-badges -- the character's own details; a badge here would reopen it -->
<Dialog bind:open title={character.name} size="full">
	<!-- Always shown, whichever section is open (Trevor, 2026-10-16). -->
	<div
		class="own"
		bind:this={summaryEl}
		data-testid="own-summary"
		data-pulse={pulse ? '' : undefined}
		onanimationend={(event) => {
			if (event.target === event.currentTarget) pulse = false;
		}}
	>
		<CharacterSummary {character} icon={given} {seat} />
	</div>
	<ContentsLayout
		label={t('characters.moreFromWiki')}
		{items}
		{current}
		onSelect={go}
		home={selected === undefined}
		backLabel={t('characters.summary')}
		onBack={() => go('summary')}
		hideNav={!officialData.current}
	>
		{#if selected === 'jinxes'}
			<section class="wiki-page" data-testid="jinx-section" aria-label={t('characters.jinxes')}>
				<h3>{t('characters.jinxes')}</h3>
				{#each jinxes as jinx (jinx.characters.join())}
					<!-- The other character as a text-size badge across the section, the jinx indented
					     under it, as on the Reference card (Trevor, 2026-10-16). -->
					<CharacterEntry
						characterId={jinx.characters.find((id) => id !== character.id) ?? jinx.characters[1]}
					>
						<p class="jinx-text"><GlossaryText text={jinx.reason} /></p>
					</CharacterEntry>
				{:else}
					<p>{t('common.none')}</p>
				{/each}
			</section>
		{:else if shown}
			<!-- The wiki's own page, word for word (never bundled; see wiki-page.svelte.ts). -->
			<section class="wiki-page" data-testid="wiki-section" aria-label={label(shown)}>
				<h3>{label(shown)}</h3>
				{@render blocks(shown)}
			</section>
		{:else if page}
			<section class="wiki-page" aria-label={t('characters.wikiPage')} data-testid="wiki-page">
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
	</ContentsLayout>
	{#snippet headActions()}
		{#if wiki}
			<!-- The wiki page (the rules authority), in a new tab. -->
			<IconButton icon="wiki" label={t('characters.openWiki')} href={wiki} />
		{:else if sourcePage}
			<IconButton
				icon="wiki"
				label={t('characters.openSourcePage')}
				href={sourcePage}
				rel="noopener noreferrer"
			/>
		{:else}
			<!-- Homebrew: no wiki page. Shown disabled so the header is the same for every character. -->
			<IconButton icon="wiki" label={t('characters.noWiki')} disabled />
		{/if}
	{/snippet}
</Dialog>

<style>
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
	.wiki-page .jinx-text {
		margin: 0;
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
	/* A colour flash, not movement, so it shows with reduced motion too. */
	.own {
		flex: none;
		border-radius: var(--radius-md);
	}
	.own[data-pulse] {
		animation: own-pulse 0.9s ease-out;
	}
	/* Drawn inside the box, so the dialog's edges never clip it (Trevor, 2026-10-24: only the
	   bottom and corners showed). */
	@keyframes own-pulse {
		0%,
		30% {
			background-color: var(--surface-selected);
			box-shadow: inset 0 0 0 calc(0.15 * var(--u)) var(--accent);
		}
		100% {
			background-color: transparent;
			box-shadow: inset 0 0 0 calc(0.15 * var(--u)) transparent;
		}
	}
</style>
