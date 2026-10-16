<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { parseRich, toSource, type TextRun } from './bold.ts';

	interface Props {
		/** The text with `**bold**` and `*italic*` markers, as custom info tokens store it. */
		value: string;
		label: string;
		/** Longest text, counted without markers. */
		maxlength: number;
		/** Enter was pressed: the field is one line, so Enter commits (Trevor's rule). */
		onsubmit?: () => void;
	}

	let { value = $bindable(), label, maxlength, onsubmit }: Props = $props();

	let field = $state<HTMLDivElement>();
	let bold = $state(false);
	let italic = $state(false);
	/** The value this field last wrote, so its own edits never re-render it under the caret. */
	let written: string | undefined;

	// Shows the stored text formatted; a value set from outside (another card) replaces it.
	$effect(() => {
		if (!field || value === written) return;
		// The field has no Svelte-rendered children: the browser and this effect own its content.
		// eslint-disable-next-line svelte/no-dom-manipulating
		field.replaceChildren(
			...parseRich(value).map((run) => {
				let node: Node = document.createTextNode(run.text);
				if (run.italic) node = wrap('em', node);
				if (run.bold) node = wrap('strong', node);
				return node;
			})
		);
		written = value;
	});

	function wrap(tag: string, child: Node) {
		const element = document.createElement(tag);
		element.append(child);
		return element;
	}

	/** Reads the formatted text back as runs (the browser writes b/strong/i/em or styles). */
	function runsOf(root: Node): TextRun[] {
		const runs: TextRun[] = [];
		const walk = (node: Node, isBold: boolean, isItalic: boolean) => {
			if (node.nodeType === Node.TEXT_NODE) {
				runs.push({ text: node.textContent ?? '', bold: isBold, italic: isItalic });
				return;
			}
			if (!(node instanceof HTMLElement)) return;
			const tag = node.tagName;
			const weight = node.style.fontWeight;
			const nextBold =
				tag === 'B' || tag === 'STRONG' || weight === 'bold' || Number(weight) >= 600
					? true
					: weight === 'normal'
						? false
						: isBold;
			const nextItalic =
				tag === 'I' || tag === 'EM' || node.style.fontStyle === 'italic'
					? true
					: node.style.fontStyle === 'normal'
						? false
						: isItalic;
			node.childNodes.forEach((child) => walk(child, nextBold, nextItalic));
		};
		root.childNodes.forEach((child) => walk(child, false, false));
		return runs;
	}

	function read() {
		if (!field) return;
		let runs = runsOf(field);
		// Over the limit: keep the first characters, formatting and all.
		let left = maxlength;
		runs = runs.flatMap((run) => {
			const text = run.text.slice(0, Math.max(0, left));
			left -= text.length;
			return text ? [{ ...run, text }] : [];
		});
		written = toSource(runs);
		value = written;
	}

	function syncButtons() {
		if (!field || !field.contains(document.getSelection()?.anchorNode ?? null)) return;
		bold = document.queryCommandState('bold');
		italic = document.queryCommandState('italic');
	}

	function format(command: 'bold' | 'italic') {
		field?.focus();
		// execCommand is the only way to format a selection in an editable field everywhere.
		document.execCommand(command);
		syncButtons();
		read();
	}
</script>

<svelte:document onselectionchange={syncButtons} />

<div class="rich">
	<div class="tools" role="toolbar" aria-label={t('info-tokens.formatting')}>
		<button
			type="button"
			class="tool"
			aria-label={t('info-tokens.bold')}
			aria-pressed={bold}
			onpointerdown={(e) => e.preventDefault()}
			onclick={() => format('bold')}><strong>B</strong></button
		>
		<button
			type="button"
			class="tool"
			aria-label={t('info-tokens.italic')}
			aria-pressed={italic}
			onpointerdown={(e) => e.preventDefault()}
			onclick={() => format('italic')}><em>I</em></button
		>
	</div>
	<div
		bind:this={field}
		class="field"
		role="textbox"
		tabindex="0"
		aria-label={label}
		aria-multiline="false"
		contenteditable="true"
		spellcheck="true"
		oninput={read}
		onkeydown={(e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				onsubmit?.();
			}
		}}
		onpaste={(e) => {
			// Pasted text arrives plain: no styles or markup from elsewhere.
			e.preventDefault();
			const text = e.clipboardData?.getData('text/plain').replace(/\s*\n\s*/g, ' ') ?? '';
			document.execCommand('insertText', false, text);
		}}
	></div>
</div>

<style>
	.rich {
		display: grid;
		gap: var(--space-1);
	}
	.tools {
		display: flex;
		gap: var(--space-1);
	}
	.tool {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: inherit;
		font-family: var(--font-heading);
		font-size: 1.1rem;
		cursor: pointer;
	}
	.tool[aria-pressed='true'] {
		background: var(--choice-selected-background);
		box-shadow: inset 0 0 0 2px var(--focus);
	}
	.field {
		min-height: calc(2 * var(--tap-target));
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: inherit;
		font-family: var(--font-heading);
		font-size: 1.1rem;
		line-height: 1.3;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}
	.field:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}
	.field :global(strong) {
		color: var(--accent);
	}
</style>
