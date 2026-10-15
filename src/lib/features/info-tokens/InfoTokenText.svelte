<script lang="ts">
	import { parseBold } from './bold.ts';

	let { text }: { text: string } = $props();
</script>

<!-- Info-token text with its **bold** runs, as text nodes (never HTML). -->
{#each parseBold(text) as run, i (i)}{#if run.bold}<strong>{run.text}</strong
		>{:else}{run.text}{/if}{/each}
