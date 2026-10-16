<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { CharacterType } from '#lib/core/data/index.ts';
	import type { ReferenceSegment } from '#lib/core/rules/reference.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { explainBlock } from '#lib/features/glossary/glossary.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';

	interface Props {
		segments: readonly ReferenceSegment[];
		/** Type of the character the reminder belongs to, to colour its tokens. */
		type: CharacterType;
	}

	let { segments, type }: Props = $props();
	const explained = $derived(explainBlock(segments.map((s) => (s.kind === 'text' ? s.text : ''))));
</script>

<!-- A pre-day reminder as the Storyteller sees it: badges and our short words. -->
<span class="sentence">
	{#each segments as segment, i (i)}
		{#if segment.kind === 'character'}
			<CharacterBadge characterId={segment.characterId} inline />
		{:else if segment.kind === 'target'}
			<span class="target"
				>{t('reference.playerWith')} <ReminderToken label={segment.token} {type} /></span
			>
		{:else if segment.kind === 'value'}
			<!-- A value the Storyteller enters during prep (the Yaggababble's phrase). -->
			<span>({segment.placeholder})</span>
		{:else}
			<span><GlossaryText segments={explained[i] ?? []} /></span>
		{/if}
	{/each}
</span>

<style>
	.sentence {
		font-family: var(--font-ability);
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
	}
	.target {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--on-surface-muted);
	}
</style>
