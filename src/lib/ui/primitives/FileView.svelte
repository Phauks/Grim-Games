<script lang="ts">
	import { copyText } from '#lib/ui/clipboard.ts';
	import { downloadFile } from '#lib/ui/download.ts';
	import { jsonLineTokens } from '#lib/ui/json-tokens.ts';
	import IconButton from './IconButton.svelte';

	/**
	 * A file's contents shown as a file (Trevor, 2026-10-18: "Mode File in header with line
	 * numbers and the works, standard component for all showcases"): a header bar with its name
	 * and Copy and Download side by side, then the text with line numbers. The numbers are
	 * drawn, not text, so selecting the file copies only the file. To start it closed, put it
	 * in a Collapsible, like every other section that folds away. A JSON file is coloured by
	 * kind of piece (Trevor, 2026-10-19).
	 */
	interface Props {
		title: string;
		text: string;
		/** The downloaded file's name. */
		fileName: string;
		copyLabel: string;
		downloadLabel: string;
		type?: string;
		testid?: string;
	}

	let {
		title,
		text,
		fileName,
		copyLabel,
		downloadLabel,
		type = 'application/json',
		testid
	}: Props = $props();

	const NL = '\n';
	const lines = $derived(text.split(NL));
	const json = $derived(type === 'application/json');
</script>

<figure class="file" data-testid={testid}>
	<figcaption class="head">
		<span class="name">{title}</span>
		<span class="actions">
			<!-- Clipboard blocked: the text is still shown to select by hand. -->
			<IconButton icon="copy" label={copyLabel} onclick={() => void copyText(text)} />
			<IconButton
				icon="download"
				label={downloadLabel}
				onclick={() => downloadFile(fileName, text, type)}
			/>
		</span>
	</figcaption>
	<pre class="body"><code
			>{#each lines as line, i (i)}<span class="line"
					><!-- One grid cell beside the number, however many coloured pieces. --><span
						>{#if json}{#each jsonLineTokens(line) as token, j (j)}{#if token.kind === 'plain'}{token.text}{:else}<span
										class={token.kind}>{token.text}</span
									>{/if}{/each}{:else}{line}{/if}{NL}</span
					></span
				>{/each}</code
		></pre>
</figure>

<style>
	.file {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		margin: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	/* Copy and Download stay in reach while a long file scrolls under them. */
	.head {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-inline: var(--space-2) var(--space-1);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		background: var(--surface-raised);
	}
	/* The rule under the header. */
	.head:has(+ .body) {
		border-bottom: 1px solid var(--border);
	}
	.name {
		flex: 1;
		min-width: 0;
		font-weight: 600;
	}
	.actions {
		display: flex;
		flex: none;
	}
	.body {
		margin: 0;
		padding: var(--space-2) var(--space-2) var(--space-2) 0;
		/* A pre keeps the browser's monospace face (no font role for code). */
		counter-reset: line;
		font-size: 0.85rem;
		line-height: 1.5;
		tab-size: 2;
	}
	/* Each line wraps under itself, its number in a gutter beside it. */
	.line {
		display: grid;
		grid-template-columns: 3.5ch minmax(0, 1fr);
		column-gap: 1.5ch;
		counter-increment: line;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.line::before {
		content: counter(line);
		color: var(--on-surface-muted);
		text-align: end;
		user-select: none;
	}
	.key {
		color: var(--code-key);
	}
	.string {
		color: var(--code-string);
	}
	.number {
		color: var(--code-number);
	}
	.literal {
		color: var(--code-literal);
	}
	.punctuation {
		color: var(--code-punctuation);
	}
</style>
