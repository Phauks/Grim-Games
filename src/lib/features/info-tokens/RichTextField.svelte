<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import {
		INK_COLORS,
		INK_TOKENS,
		parseRich,
		toSource,
		type InkColor,
		type TextRun
	} from './bold.ts';

	interface Props {
		/** The text with `**bold**`, `*italic*` and `[red]colour[/red]` marks, as stored. */
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
	let underline = $state(false);
	/** The colour at the caret; undefined is the card's own text colour. */
	let ink = $state<InkColor>();
	/** The colours sit in a popover, so the tools fit one row above the words (Trevor, 2026-10-18). */
	let choosingInk = $state(false);
	let inkButton = $state<HTMLButtonElement>();
	/** The selection when the colours opened: the popover takes focus, this brings it back. */
	let savedRange: Range | undefined;
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
				if (run.underline) node = wrap('u', node);
				if (run.color) {
					const span = wrap('span', node);
					span.dataset.ink = run.color;
					span.style.color = INK_TOKENS[run.color];
					node = span;
				}
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

	/** Each colour as the browser resolves it here, to recognise the colours it writes. */
	function resolvedInks(): Map<string, InkColor> {
		// A lookup built and read in one call, never state.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const resolved = new Map<string, InkColor>();
		if (!field) return resolved;
		const probe = document.createElement('span');
		// A probe in the field, removed at once, to read colours as the browser resolves them.
		// eslint-disable-next-line svelte/no-dom-manipulating
		field.append(probe);
		for (const color of INK_COLORS) {
			probe.style.color = INK_TOKENS[color];
			resolved.set(getComputedStyle(probe).color, color);
		}
		probe.remove();
		return resolved;
	}

	/**
	 * The colour a piece of text is drawn in, matched to the palette. Only what shows counts,
	 * whatever spans the browser wrote or split (Trevor, 2026-10-17: changing a saved colour
	 * misbehaved while the field's own marks were trusted). The field's text colour is none.
	 */
	function inkOf(element: Element, inks: Map<string, InkColor>): InkColor | undefined {
		if (!field) return undefined;
		const shown = getComputedStyle(element).color;
		if (shown === getComputedStyle(field).color) return undefined;
		return inks.get(shown);
	}

	/** Reads the formatted text back as runs (the browser writes b/strong/i/em or styles). */
	function runsOf(root: Node): TextRun[] {
		const runs: TextRun[] = [];
		const inks = resolvedInks();
		const walk = (node: Node, isBold: boolean, isItalic: boolean, isUnderline: boolean) => {
			if (node.nodeType === Node.TEXT_NODE) {
				const color = node.parentElement ? inkOf(node.parentElement, inks) : undefined;
				runs.push({
					text: node.textContent ?? '',
					bold: isBold,
					italic: isItalic,
					...(isUnderline ? { underline: true } : {}),
					...(color ? { color } : {})
				});
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
			const nextUnderline =
				tag === 'U' || node.style.textDecorationLine.includes('underline') || isUnderline;
			node.childNodes.forEach((child) => walk(child, nextBold, nextItalic, nextUnderline));
		};
		root.childNodes.forEach((child) => walk(child, false, false, false));
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
		underline = document.queryCommandState('underline');
		ink = inkAtCaret();
	}

	function inkAtCaret(): InkColor | undefined {
		const node = document.getSelection()?.anchorNode ?? null;
		const element = node instanceof Element ? node : node?.parentElement;
		return element && field?.contains(element) ? inkOf(element, resolvedInks()) : undefined;
	}

	function format(command: 'bold' | 'italic' | 'underline') {
		field?.focus();
		// execCommand is the only way to format a selection in an editable field everywhere.
		document.execCommand(command);
		syncButtons();
		read();
	}

	/** Colours the selection (or what is typed next); undefined goes back to the text colour. */
	function openInks() {
		const selection = document.getSelection();
		savedRange =
			selection?.rangeCount && field?.contains(selection.anchorNode)
				? selection.getRangeAt(0).cloneRange()
				: undefined;
		choosingInk = true;
	}

	function colour(color: InkColor | undefined) {
		if (!field) return;
		choosingInk = false;
		field.focus();
		if (savedRange) {
			const selection = document.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(savedRange);
			savedRange = undefined;
		}
		const value = color
			? ([...resolvedInks()].find(([, c]) => c === color)?.[0] ?? '')
			: getComputedStyle(field).color;
		document.execCommand('styleWithCSS', false, 'true');
		document.execCommand('foreColor', false, value);
		syncButtons();
		read();
	}
</script>

<svelte:document onselectionchange={syncButtons} />

<!-- The tools sit above the words, outside their box, so the words get its whole width
     (Trevor, 2026-10-31). -->
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
		<button
			type="button"
			class="tool"
			aria-label={t('info-tokens.underline')}
			aria-pressed={underline}
			onpointerdown={(e) => e.preventDefault()}
			onclick={() => format('underline')}><u>U</u></button
		>
		<!-- The colour at the caret, under its letter; tapping it offers the others. -->
		<button
			bind:this={inkButton}
			type="button"
			class="tool swatch"
			aria-label={t('info-tokens.colour')}
			aria-haspopup="dialog"
			aria-expanded={choosingInk}
			onpointerdown={(e) => e.preventDefault()}
			onclick={openInks}
			><span class="letter" style:color={ink ? INK_TOKENS[ink] : undefined}>A</span><span
				class="bar"
				style:background={ink ? INK_TOKENS[ink] : 'currentColor'}
			></span></button
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

<Popover bind:open={choosingInk} title={t('info-tokens.colour')} anchor={inkButton}>
	<div class="inks" role="group" aria-label={t('info-tokens.colour')}>
		<button
			type="button"
			class="tool swatch"
			aria-label={t('info-tokens.colourNone')}
			aria-pressed={ink === undefined}
			onclick={() => colour(undefined)}><span class="letter">A</span></button
		>
		{#each INK_COLORS as color (color)}
			<button
				type="button"
				class="tool swatch"
				aria-label={t(`info-tokens.colours.${color}`)}
				aria-pressed={ink === color}
				onclick={() => colour(color)}
				><span class="letter" style:color={INK_TOKENS[color]}>A</span><span
					class="bar"
					style:background={INK_TOKENS[color]}
				></span></button
			>
		{/each}
	</div>
</Popover>

<style>
	.rich {
		display: grid;
		gap: var(--space-1);
	}
	.tools {
		display: flex;
	}
	.inks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.swatch {
		position: relative;
		font-weight: 900;
	}
	/* The colour under the letter, so a colour reads even where it is close to the background. */
	.bar {
		position: absolute;
		inset-inline: 25%;
		bottom: 15%;
		height: 10%;
		border-radius: var(--radius-sm);
	}
	.tool {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font-family: var(--font-heading);
		font-size: 1.1rem;
		cursor: pointer;
	}
	.inks .tool {
		border: 1px solid var(--border);
	}
	.tool:hover {
		background: var(--surface-hover);
	}
	.tool[aria-pressed='true'] {
		background: var(--choice-selected-background);
		box-shadow: inset 0 0 0 2px var(--focus);
	}
	/* The words' own box. */
	.field {
		min-width: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		min-height: var(--tap-target);
		padding: var(--space-2);
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
	/* Bold is weight, never colour (Trevor, 2026-10-16); browsers write b or strong. */
	.field :global(strong),
	.field :global(b) {
		font-weight: 900;
	}
</style>
