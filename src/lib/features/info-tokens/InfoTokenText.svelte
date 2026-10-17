<script lang="ts">
	import { INK_TOKENS, parseRich, type TextRun } from './bold.ts';

	let { text }: { text: string } = $props();
</script>

<!-- Info-token text with its bold, italic, underlined and coloured runs, as text nodes (never HTML). -->
{#snippet styled(run: TextRun)}{#if run.underline}<u>{@render weighted(run)}</u
		>{:else}{@render weighted(run)}{/if}{/snippet}
{#snippet weighted(run: TextRun)}{#if run.bold && run.italic}<strong><em>{run.text}</em></strong
		>{:else if run.bold}<strong>{run.text}</strong>{:else if run.italic}<em>{run.text}</em
		>{:else}{run.text}{/if}{/snippet}
{#each parseRich(text) as run, i (i)}{#if run.color}<span
			class="ink"
			data-ink={run.color}
			style:color={INK_TOKENS[run.color]}>{@render styled(run)}</span
		>{:else}{@render styled(run)}{/if}{/each}

<style>
	/* Real bold weight (Trevor, 2026-10-16): the heaviest loaded, since display text is
	   already 600 and 700 would pick the same face. */
	strong {
		font-weight: 900;
	}
</style>
