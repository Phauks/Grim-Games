<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { wikiUrl, type Character } from '#lib/core/data/index.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import { clearTermHandler } from '#lib/features/glossary/term-handler.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { iconUrl } from './icon-url.ts';
	import { jinxesFor } from '#lib/core/data/jinxes.ts';
	import CharacterBadge from './CharacterBadge.svelte';
	import { officialData } from './game-data.svelte.ts';
	import { EDITION_LABELS } from '#lib/features/reference/labels.ts';
	import ContentsLayout, { type ContentsItem } from './ContentsLayout.svelte';
	import ReminderToken from './ReminderToken.svelte';
	import WikiBox from './WikiBox.svelte';
	import { wikiPageTitle, withoutRepeats, type WikiSection } from './wiki-page.ts';
	import { wikiPages } from './wiki-page.svelte.ts';

	interface Props {
		open?: boolean;
		character: Character;
		icon?: string;
	}

	let { open = $bindable(false), character, icon: given }: Props = $props();
	// Terms here open their popover, even when these details were opened from the Glossary.
	clearTermHandler();
	// Callers may pass the seat's icon (its alignment); otherwise the character's own.
	const icon = $derived(given ?? iconUrl(character));
	const wiki = $derived(wikiUrl(character));
	const typeLabel = $derived(character.type[0].toUpperCase() + character.type.slice(1));
	// Where the character comes from, as in the Reference: TPI's edition, or Homebrew for a
	// script's own character. Fabled and Loric are their own edition, so it is not repeated.
	const source = $derived(
		character.edition
			? (EDITION_LABELS[character.edition] ?? character.edition)
			: t('characters.homebrew')
	);
	/** TPI's reminder tokens, then the global ones, as in the Reference. */
	const reminders = $derived([
		...character.reminders.map((label) => ({ label, global: false })),
		...character.remindersGlobal.map((label) => ({ label, global: true }))
	]);
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
			: /tips/i.test(section.heading)
				? 'characters.tip'
				: undefined;
	const items = $derived<ContentsItem[]>([
		{ id: 'summary', label: t('characters.summary'), wideOnly: true },
		{ id: 'jinxes', label: t('characters.jinxes') },
		...others.map((section, i) => ({ id: String(i), label: label(section) }))
	]);
	const current = $derived(
		selected === undefined ? 'summary' : selected === 'jinxes' ? 'jinxes' : String(selected)
	);
	function go(id: string) {
		selected = id === 'summary' ? undefined : id === 'jinxes' ? 'jinxes' : Number(id);
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
		{:else if block.kind === 'example' && !isExamples(section)}
			<!-- The wiki marks worked steps in How to Run the same way; only Examples are boxed. -->
			<p><GlossaryText text={block.text} names={[character.name]} /></p>
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
			<p class="type">{source === typeLabel ? typeLabel : `${typeLabel} · ${source}`}</p>
			<p class="ability"><GlossaryText text={character.ability} names={[character.name]} /></p>
			<!-- Every reminder token, beside the ability on every section (Trevor, 2026-10-16). -->
			{#if reminders.length}
				<p class="reminders" data-testid="character-reminders">
					{#each reminders as reminder, i (i)}<ReminderToken
							label={reminder.global
								? t('reference.globalReminder', { label: reminder.label })
								: reminder.label}
							type={character.type}
						/>{/each}
				</p>
			{/if}
		</div>
	</header>
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
					<div class="jinx">
						<span class="pair"
							><CharacterBadge characterId={jinx.characters[0]} inline /><CharacterBadge
								characterId={jinx.characters[1]}
								inline
							/></span
						>
						<p><GlossaryText text={jinx.reason} /></p>
					</div>
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
	.reminders {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		margin: var(--space-2) 0 0;
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
	.jinx {
		padding: var(--space-2) 0;
		border-bottom: var(--card-border);
	}
	.jinx .pair {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-bottom: var(--space-1);
	}
	.jinx p {
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
