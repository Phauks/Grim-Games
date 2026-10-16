<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { GLOSSARY, glossaryEntryUrl, type GlossaryTerm } from '#lib/core/rules/glossary.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import { glossaryPopover } from './glossary-popover.svelte.ts';
	import { glossaryDialog } from './glossary-dialog.svelte.ts';
	import GlossaryDialog from './GlossaryDialog.svelte';
	import { glossaryKey } from './wiki-glossary.ts';
	import { wikiGlossary } from './wiki-glossary.svelte.ts';
	import WikiEntryText from './WikiEntryText.svelte';

	const keepOpenOn = (target: Element) => target.closest('.glossary-term') !== null;
	// The wiki's own text is fetched the first time a term is opened (and cached on the device).
	$effect(() => {
		if (glossaryPopover.open) void wikiGlossary.load();
	});
	const entry = $derived(
		glossaryPopover.term ? wikiGlossary.definition(glossaryPopover.term.term) : undefined
	);
	const previous = $derived(glossaryPopover.history.at(-1));

	/** Our term for a Glossary entry, or one made from the wiki's entry name. */
	function termFor(key: string): GlossaryTerm {
		const ours = GLOSSARY.find((t) => glossaryKey(t.term) === key);
		if (ours) return ours;
		const name = wikiGlossary.entries.get(key)?.name ?? key;
		return { id: `wiki:${key}`, term: name, variants: [], url: glossaryEntryUrl(name) };
	}
	/** The whole Glossary in a dialog, open on this entry (Trevor, 2026-10-16). */
	function openGlossary() {
		const term = glossaryPopover.term;
		glossaryPopover.open = false;
		glossaryDialog.show(term ? glossaryKey(term.term) : undefined);
	}
</script>

<!--
	The shared overlay for every GlossaryTerm (mounted once, in the layout): the wiki
	Glossary's own wording when it has been fetched, and always the link to the entry. Links
	in the wording ("see Drunk") open that entry here, show a character's badge, or open the
	wiki page; the words themselves stay exactly as the wiki has them.
-->
<Popover
	bind:open={glossaryPopover.open}
	title={glossaryPopover.term?.term ?? ''}
	anchor={glossaryPopover.anchor}
	{keepOpenOn}
>
	{#if glossaryPopover.term}
		{#if previous}
			<button type="button" class="back" onclick={() => glossaryPopover.back()}
				><Icon name="back" /><span>{t('glossary.back', { term: previous.term })}</span></button
			>
		{/if}
		{#if entry}
			<WikiEntryText
				{entry}
				cite={glossaryPopover.term.url}
				onTerm={(key) => glossaryPopover.go(termFor(key))}
			/>
		{/if}
		<button type="button" class="open" onclick={openGlossary}
			><Icon name="glossary" /><span>{t('glossary.open')}</span></button
		>
	{/if}
</Popover>
<GlossaryDialog />

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font: inherit;
		cursor: pointer;
		--icon-size: 1rem;
	}
	.open {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		font-weight: 600;
		--icon-size: 1.1rem;
	}
</style>
