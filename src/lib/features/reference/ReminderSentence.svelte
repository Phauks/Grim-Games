<script lang="ts">
	import type { ReferenceSegment } from '#lib/core/rules/reference.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';

	interface Props {
		segments: readonly ReferenceSegment[];
	}

	let { segments }: Props = $props();
</script>

<!-- A pre-day reminder as the Storyteller sees it: badges and our short words. -->
<span class="sentence">
	{#each segments as segment, i (i)}
		{#if segment.kind === 'character'}
			<CharacterBadge characterId={segment.characterId} />
		{:else if segment.kind === 'target'}
			<span class="target">player with “{segment.token}”</span>
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
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border-radius: var(--radius-full);
		border: 1px dashed var(--border);
		color: var(--on-surface-muted);
	}
</style>
