<script lang="ts">
	import { CHARACTER_TYPES, type CharacterType } from '#lib/core/data/types.ts';
	import { TYPE_LABELS, TYPE_PLURALS } from '#lib/features/reference/labels.ts';

	/**
	 * How many characters of each type, on one line that wraps: "13 Townsfolk · 4 Outsiders ·
	 * 1 Demon". Types with none are left out. Part of the one player count component family
	 * (Trevor, 2026-10-17), for the script details.
	 */
	interface Props {
		counts: Partial<Record<CharacterType, number>>;
	}

	let { counts }: Props = $props();
	const types = $derived(CHARACTER_TYPES.filter((type) => (counts[type] ?? 0) > 0));
</script>

<span class="type-counts" data-testid="type-counts">
	{#each types as type, i (type)}
		{#if i > 0}<span aria-hidden="true">·</span>{/if}
		<span class="item"
			><span data-type={type}>{counts[type]}</span>
			{counts[type] === 1 ? TYPE_LABELS[type] : TYPE_PLURALS[type]}</span
		>
	{/each}
</span>

<style>
	.type-counts {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0 var(--space-1);
		min-width: 0;
	}
	.item {
		white-space: nowrap;
	}
	[data-type] {
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
</style>
