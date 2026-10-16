<script lang="ts">
	import type { Snippet } from 'svelte';
	import { splitSlots } from './slots.ts';

	interface Props {
		/** Text from `t()`, with `slot(name)` placeholders. */
		text: string;
		/** Draws one slot by name: a CharacterBadge or ReminderToken. */
		fill: Snippet<[string]>;
	}

	let { text, fill }: Props = $props();
	const parts = $derived(splitSlots(text));
</script>

<!-- A catalog sentence with names as badges (slots.ts). -->
{#each parts as part, i (i)}{#if i % 2 === 1}{@render fill(part)}{:else}{part}{/if}{/each}
