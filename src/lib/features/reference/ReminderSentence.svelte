<script lang="ts">
	import type { CharacterType } from '#lib/core/data/index.ts';
	import type { ReferenceSegment } from '#lib/core/rules/reference.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';

	interface Props {
		segments: readonly ReferenceSegment[];
		/** Type of the character the reminder belongs to, to colour its tokens. */
		type: CharacterType;
	}

	let { segments, type }: Props = $props();
</script>

<!-- A pre-day reminder as the Storyteller sees it: badges and our short words. -->
<span class="sentence">
	{#each segments as segment, i (i)}
		{#if segment.kind === 'character'}
			<CharacterBadge characterId={segment.characterId} />
		{:else if segment.kind === 'target'}
			<span class="target">player with <ReminderToken label={segment.token} {type} /></span>
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
	.target {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--on-surface-muted);
	}
</style>
