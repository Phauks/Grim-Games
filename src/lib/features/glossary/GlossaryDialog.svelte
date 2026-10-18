<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { GLOSSARY, glossaryEntryUrl, GLOSSARY_URL } from '#lib/core/rules/glossary.ts';
	import ContentsLayout, { type ContentsItem } from '#lib/ui/layout/ContentsLayout.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import { glossaryDialog } from './glossary-dialog.svelte.ts';
	import { glossaryKey } from './wiki-glossary.ts';
	import { glossaryPopover } from './glossary-popover.svelte.ts';
	import { glossaryTermFor, wikiGlossary } from './wiki-glossary.svelte.ts';
	import WikiEntryText from './WikiEntryText.svelte';
	import { clearTermHandler } from './term-handler.ts';

	// The wiki's text is fetched live when the dialog opens (and cached on the device only).
	let loading = $state(false);
	$effect(() => {
		if (!glossaryDialog.open) return;
		loading = true;
		void wikiGlossary.load().finally(() => (loading = false));
	});
	// Terms in an entry open their popup over it, as anywhere else (Trevor, 2026-10-16).
	clearTermHandler();
	let search = $state('');
	$effect(() => {
		if (!glossaryDialog.open) search = '';
	});

	/** Every wiki entry by name; our own terms until the wiki's have been fetched. */
	const all = $derived<ContentsItem[]>(
		(wikiGlossary.entries.size > 0
			? [...wikiGlossary.entries].map(([id, entry]) => ({ id, label: entry.name }))
			: GLOSSARY.map((term) => ({ id: glossaryKey(term.term), label: term.term }))
		).sort((a, b) => a.label.localeCompare(b.label))
	);
	const items = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return query ? all.filter((item) => item.label.toLowerCase().includes(query)) : all;
	});
	const key = $derived(glossaryDialog.key);
	const entry = $derived(key ? wikiGlossary.entries.get(key) : undefined);
	const name = $derived(entry?.name ?? all.find((item) => item.id === key)?.label);
	const wikiLink = $derived(name ? glossaryEntryUrl(name) : GLOSSARY_URL);
</script>

<!--
	The whole wiki Glossary in a dialog over any screen (Trevor, 2026-10-16): every entry in a
	searchable list on the left, the chosen entry's own wording on the right, laid out like
	character details. On a phone the list comes first and an entry slides in over it.
-->
<Dialog bind:open={glossaryDialog.open} title={t('glossary.title')} size="full">
	<ContentsLayout
		label={t('glossary.entries')}
		{items}
		current={key}
		onSelect={(id) => (glossaryDialog.key = id)}
		home={key === undefined}
		paneAtHome={false}
		backLabel={t('glossary.title')}
		onBack={() => (glossaryDialog.key = undefined)}
	>
		{#snippet navTop()}
			<SearchField
				bind:value={search}
				label={t('glossary.search')}
				placeholder={t('glossary.searchPlaceholder')}
			/>
		{/snippet}
		{#if name}
			<section class="entry" aria-label={name} data-testid="glossary-entry">
				<h3>{name}</h3>
				{#if entry && key}
					<WikiEntryText
						{entry}
						cite={glossaryEntryUrl(entry.name)}
						term={glossaryTermFor(key).id}
						onTerm={(id, link) => glossaryPopover.show(glossaryTermFor(id), link)}
					/>
				{:else if loading}
					<p class="muted">{t('glossary.loading')}</p>
				{:else}
					<p class="muted">{t('glossary.failed')}</p>
				{/if}
			</section>
		{/if}
	</ContentsLayout>
	{#snippet headActions()}
		<!-- External wiki Glossary (the rules authority), not an app route. -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			class="wiki"
			href={wikiLink}
			target="_blank"
			rel="noopener"
			aria-label={t('glossary.openWiki')}
			title={t('glossary.openWiki')}
		>
			<Icon name="wiki" />
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/snippet}
</Dialog>

<style>
	.entry {
		line-height: 1.5;
	}
	.entry h3 {
		margin: 0 0 var(--space-2);
		font-size: 1rem;
	}
	.muted {
		color: var(--on-surface-muted);
	}
	.wiki {
		display: grid;
		place-items: center;
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		border-radius: var(--radius-md);
		color: inherit;
		text-decoration: none;
	}
	.wiki:hover {
		background: var(--surface-selected);
	}
</style>
