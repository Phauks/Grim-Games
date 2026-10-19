<script lang="ts">
	import { copyText } from '#lib/ui/clipboard.ts';
	import { downloadFile } from '#lib/ui/download.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import IconButton from './IconButton.svelte';

	/**
	 * A file's contents shown as a file (Trevor, 2026-10-18: "Mode File in header with line
	 * numbers and the works, standard component for all showcases"): a header bar with its name
	 * and Copy and Download side by side, then the text with line numbers. The numbers are
	 * drawn, not text, so selecting the file copies only the file. `collapsible` makes the
	 * name the toggle, starting closed unless `open`.
	 */
	interface Props {
		title: string;
		text: string;
		/** The downloaded file's name. */
		fileName: string;
		copyLabel: string;
		downloadLabel: string;
		type?: string;
		collapsible?: boolean;
		open?: boolean;
		testid?: string;
	}

	let {
		title,
		text,
		fileName,
		copyLabel,
		downloadLabel,
		type = 'application/json',
		collapsible = false,
		open = $bindable(!collapsible),
		testid
	}: Props = $props();

	const NL = '\n';
	const lines = $derived(text.split(NL));
	const bodyId = $props.id();
</script>

<figure class="file" data-testid={testid}>
	<figcaption class="head">
		{#if collapsible}
			<button
				type="button"
				class="name toggle"
				aria-expanded={open}
				aria-controls={bodyId}
				onclick={() => (open = !open)}
			>
				<span class="caret" class:open><Icon name="expand" /></span>
				{title}
			</button>
		{:else}
			<span class="name">{title}</span>
		{/if}
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
	<pre id={bodyId} class="body" hidden={!open}><code
			>{#each lines as line, i (i)}<span class="line">{line}{NL}</span>{/each}</code
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
	/* The rule under the header only when the file shows; closed, the header is the whole box. */
	.head:has(+ .body:not([hidden])) {
		border-bottom: 1px solid var(--border);
	}
	.name {
		flex: 1;
		min-width: 0;
		font-weight: 600;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		font-weight: 600;
		text-align: start;
		cursor: pointer;
	}
	.caret {
		display: inline-flex;
		transform: rotate(-90deg);
		transition: transform 0.15s;
	}
	.caret.open {
		transform: none;
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
	.body[hidden] {
		display: none;
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
</style>
