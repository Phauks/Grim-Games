<script lang="ts">
	import type { CharacterId, CharacterType } from '#lib/core/data/index.ts';
	import type { ReferenceSegment } from '#lib/core/rules/reference.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';

	interface Props {
		segments: readonly ReferenceSegment[];
		/** Type of the character the reminder belongs to, to colour its tokens. */
		type: CharacterType;
		/** The character the reminder belongs to: its icon goes on its tokens. */
		characterId?: CharacterId;
	}

	let { segments, type, characterId }: Props = $props();
</script>

<!-- A pre-day reminder as the Storyteller sees it: badges and our short words. -->
<span class="sentence">
	{#each segments as segment, i (i)}
		{#if segment.kind === 'character'}
			<CharacterBadge characterId={segment.characterId} />
		{:else if segment.kind === 'target'}
			<span class="target"
				>player with <ReminderToken
					label={segment.token}
					{type}
					{...characterId ? { characterId } : {}}
				/></span
			>
		{:else if segment.kind === 'value'}
			<span class="value" title="Entered by the Storyteller during prep">{segment.placeholder}</span>
		{:else}
			<span>{segment.text}</span>
		{/if}
	{/each}
</span>

<style>
	.sentence {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
	}
	.value {
		padding: 0 0.4em;
		border: 1px dashed var(--on-surface-muted);
		border-radius: var(--radius-sm, 0.25em);
		font-variant: small-caps;
	}
	.target {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--on-surface-muted);
	}
</style>
