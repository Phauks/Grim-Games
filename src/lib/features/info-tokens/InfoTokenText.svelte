<script lang="ts">
	import { parseRich } from './bold.ts';

	let { text }: { text: string } = $props();
</script>

<!-- Info-token text with its bold and italic runs, as text nodes (never HTML). -->
{#each parseRich(text) as run, i (i)}{#if run.bold && run.italic}<strong><em>{run.text}</em></strong
		>{:else if run.bold}<strong>{run.text}</strong>{:else if run.italic}<em>{run.text}</em
		>{:else}{run.text}{/if}{/each}
