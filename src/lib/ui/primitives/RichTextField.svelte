<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import { afterLineBreak } from '#lib/core/text/lists.ts';
	import {
		INK_COLORS,
		INK_TOKENS,
		editLines,
		parseRich,
		plainText,
		toSource,
		type InkColor,
		type TextRun
	} from '#lib/core/text/rich.ts';

	/**
	 * The one rich text box, for notes and info cards (Trevor, 2026-10-31: "same text box
	 * component as notes ... non-duplicative and we gain numbered and bullet list compat"):
	 * bold, italic, underline and colour from a row of tools above the box, stored as marks
	 * (`core/text/rich.ts`), and with `multiline`, lines and typed lists (`core/text/lists.ts`).
	 */
	interface Props {
		/** The text with `**bold**`, `*italic*` and `[red]colour[/red]` marks, as stored. */
		value: string;
		label: string;
		/** Longest text, counted without markers. */
		maxlength?: number;
		/** Enter is a new line, not a commit. */
		multiline?: boolean;
		/** With `multiline`, Enter carries a typed list on ("- ", "1. ", "a) "), as in notes. */
		lists?: boolean;
		/** Lines the box is tall before it has text; it grows with its text after that. */
		rows?: number;
		/** The words in the heading font, as a card shows them. */
		display?: boolean;
		disabled?: boolean;
		/**
		 * A note's words written in its row (Trevor, 2026-11-02): no box, the label for screen
		 * readers only, and the tools only while the words are being written, laid over the end
		 * of the row's first line (the row is their positioned parent), so nothing moves.
		 */
		inline?: boolean;
		/** True while the words have focus or the colours are open; a row hides its own buttons. */
		active?: boolean;
		/** Enter in a one-line box: Enter commits (Trevor's rule). */
		onsubmit?: () => void;
		oninput?: (value: string) => void;
	}

	let {
		value = $bindable(),
		label,
		maxlength,
		multiline = false,
		lists = false,
		rows = 1,
		display = false,
		disabled = false,
		inline = false,
		active = $bindable(false),
		onsubmit,
		oninput
	}: Props = $props();

	const labelId = $props.id();
	let field = $state<HTMLDivElement>();
	let bold = $state(false);
	let italic = $state(false);
	let underline = $state(false);
	/** The colour at the caret; undefined is the box's own text colour. */
	let ink = $state<InkColor>();
	/** The colours sit in a popover, so the tools fit one row above the words (Trevor, 2026-10-18). */
	let choosingInk = $state(false);
	let inkButton = $state<HTMLButtonElement>();
	/** The selection when the colours opened: the popover takes focus, this brings it back. */
	let savedRange: Range | undefined;
	/** Focus is inside the box or its tools. */
	let focused = $state(false);
	$effect(() => {
		active = focused || choosingInk;
	});
	/** The value this field last wrote, so its own edits never re-render it under the caret. */
	let written: string | undefined;

	// Shows the stored text formatted; a value set from outside (another card) replaces it.
	$effect(() => {
		if (!field || value === written) return;
		render(value);
	});

	/** Draws the text as formatted nodes, a `<br>` between lines. */
	function render(source: string) {
		if (!field) return;
		const nodes: Node[] = [];
		for (const run of parseRich(source)) {
			run.text.split('\n').forEach((text, i) => {
				if (i > 0) nodes.push(document.createElement('br'));
				if (text) nodes.push(styled({ ...run, text }));
			});
		}
		// A last empty line needs a `<br>` of its own for the caret to sit on.
		if (source.endsWith('\n')) nodes.push(document.createElement('br'));
		// The field has no Svelte-rendered children: the browser and this function own its content.
		// eslint-disable-next-line svelte/no-dom-manipulating
		field.replaceChildren(...nodes);
		written = source;
	}

	function styled(run: TextRun): Node {
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
	}

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

	/** The `<br>` that only holds the caret on a last empty line: not a line of its own. */
	function isEndBreak(node: Node): boolean {
		if (!field || node.nodeName !== 'BR') return false;
		for (let at: Node | null = node; at && at !== field; at = at.parentNode)
			for (let next = at.nextSibling; next; next = next.nextSibling)
				// An empty text node (left by splitting one) is nothing after it.
				if (next.nodeType !== Node.TEXT_NODE || next.textContent) return false;
		return true;
	}

	/** A block the browser wrote for a new line (a `<div>` or `<p>`), not a styled run. */
	const isBlock = (node: Node) => node.nodeName === 'DIV' || node.nodeName === 'P';

	/**
	 * Reads the formatted text back as runs (the browser writes b/strong/i/em or styles). In
	 * the text before the caret (`allBreaks`) every `<br>` is a line, the last one too.
	 */
	function runsOf(root: Node, allBreaks = false): TextRun[] {
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
			if (node.nodeName === 'BR') {
				if (allBreaks || !isEndBreak(node)) runs.push({ text: '\n', bold: false, italic: false });
				return;
			}
			if (!(node instanceof HTMLElement)) return;
			// A block after other text starts a new line.
			if (isBlock(node) && runs.length && !runs.at(-1)!.text.endsWith('\n'))
				runs.push({ text: '\n', bold: false, italic: false });
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

	/** Where the caret is, counted in the plain text (a line break counts one). */
	function caretOffset(): number | undefined {
		const selection = document.getSelection();
		if (!field || !selection?.rangeCount) return undefined;
		const range = selection.getRangeAt(0);
		if (!field.contains(range.endContainer)) return undefined;
		const before = document.createRange();
		before.selectNodeContents(field);
		before.setEnd(range.endContainer, range.endOffset);
		return runsOf(before.cloneContents(), true)
			.map((run) => run.text)
			.join('').length;
	}

	/** Puts the caret `offset` characters into the plain text. */
	function placeCaret(offset: number) {
		if (!field) return;
		let left = offset;
		let target: { node: Node; offset: number } | undefined;
		const visit = (node: Node): boolean => {
			if (node.nodeType === Node.TEXT_NODE) {
				const length = node.textContent?.length ?? 0;
				if (left <= length) return !!(target = { node, offset: left });
				left -= length;
				return false;
			}
			if (node.nodeName === 'BR') {
				if (isEndBreak(node)) return false;
				const at = [...node.parentNode!.childNodes].indexOf(node as ChildNode);
				if (left === 0) return !!(target = { node: node.parentNode!, offset: at });
				left -= 1;
				if (left === 0) return !!(target = { node: node.parentNode!, offset: at + 1 });
				return false;
			}
			return [...node.childNodes].some(visit);
		};
		[...field.childNodes].some(visit);
		const range = document.createRange();
		if (target) range.setStart(target.node, target.offset);
		else {
			range.selectNodeContents(field);
			range.collapse(false);
		}
		const selection = document.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
	}

	function read() {
		if (!field) return;
		let runs = runsOf(field);
		if (maxlength !== undefined) {
			// Over the limit: keep the first characters, formatting and all.
			let left = maxlength;
			runs = runs.flatMap((run) => {
				const text = run.text.slice(0, Math.max(0, left));
				left -= text.length;
				return text ? [{ ...run, text }] : [];
			});
		}
		const source = toSource(runs);
		// The browser wrote blocks for lines: back to one `<br>` per line, the caret kept.
		if (field.querySelector('div, p')) {
			const caret = caretOffset();
			render(source);
			if (caret !== undefined) placeCaret(caret);
		}
		written = source;
		value = source;
		oninput?.(source);
	}

	/** A new line at the caret, as a `<br>`, then a typed list carried on. */
	function newLine() {
		const selection = document.getSelection();
		if (!field || !selection?.rangeCount) return;
		const range = selection.getRangeAt(0);
		range.deleteContents();
		const br = document.createElement('br');
		range.insertNode(br);
		// At the very end, the new last line needs a `<br>` of its own for the caret.
		if (isEndBreak(br)) br.after(document.createElement('br'));
		range.setStartAfter(br);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);
		read();
		syncButtons();
		if (!lists) return;
		const caret = caretOffset();
		const plain = plainText(value);
		const edit = caret === undefined ? undefined : afterLineBreak(plain, caret);
		if (!edit) return;
		const source = editLines(value, edit.text);
		render(source);
		placeCaret(edit.start);
		value = source;
		oninput?.(source);
	}

	function onbeforeinput(event: InputEvent) {
		if (event.inputType !== 'insertParagraph' && event.inputType !== 'insertLineBreak') return;
		// Enter, also from a phone's keyboard, which often sends no "Enter" key.
		event.preventDefault();
		if (multiline) newLine();
		else onsubmit?.();
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

<!-- The label and the tools share a row above the words, outside their box, so the words get
     its whole width (Trevor, 2026-10-31). -->
<div
	class="rich"
	class:display
	class:inline
	class:active
	onfocusin={() => (focused = true)}
	onfocusout={(e) => {
		const next = e.relatedTarget;
		if (!(next instanceof Node && e.currentTarget.contains(next))) focused = false;
	}}
>
	<div class="head">
		<span class="label" id={labelId}>{label}</span>
		<div class="tools" role="toolbar" aria-label={t('info-tokens.formatting')}>
			<button
				type="button"
				class="tool"
				aria-label={t('info-tokens.bold')}
				aria-pressed={bold}
				{disabled}
				onpointerdown={(e) => e.preventDefault()}
				onclick={() => format('bold')}><strong>B</strong></button
			>
			<button
				type="button"
				class="tool"
				aria-label={t('info-tokens.italic')}
				aria-pressed={italic}
				{disabled}
				onpointerdown={(e) => e.preventDefault()}
				onclick={() => format('italic')}><em>I</em></button
			>
			<button
				type="button"
				class="tool"
				aria-label={t('info-tokens.underline')}
				aria-pressed={underline}
				{disabled}
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
				{disabled}
				onpointerdown={(e) => e.preventDefault()}
				onclick={openInks}
				><span class="letter" style:color={ink ? INK_TOKENS[ink] : undefined}>A</span><span
					class="bar"
					style:background={ink ? INK_TOKENS[ink] : 'currentColor'}
				></span></button
			>
		</div>
	</div>
	<div
		bind:this={field}
		class="field"
		role="textbox"
		tabindex="0"
		aria-labelledby={labelId}
		aria-multiline={multiline}
		aria-disabled={disabled || undefined}
		contenteditable={!disabled}
		spellcheck="true"
		style:--rows={rows}
		oninput={read}
		{onbeforeinput}
		onpaste={(e) => {
			// Pasted text arrives plain: no styles or markup from elsewhere.
			e.preventDefault();
			let text = e.clipboardData?.getData('text/plain') ?? '';
			if (!multiline) text = text.replace(/\s*\n\s*/g, ' ');
			if (!multiline || !text.includes('\n')) {
				document.execCommand('insertText', false, text);
				return;
			}
			// Line by line, each break a `<br>` as Enter makes, without carrying lists on.
			text.split(/\r?\n/).forEach((line, i) => {
				if (i > 0) {
					const selection = document.getSelection();
					const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
					if (!range) return;
					range.deleteContents();
					const br = document.createElement('br');
					range.insertNode(br);
					if (isEndBreak(br)) br.after(document.createElement('br'));
					range.setStartAfter(br);
					range.collapse(true);
				}
				if (line) document.execCommand('insertText', false, line);
			});
			read();
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
		min-width: 0;
	}
	/* The label at the start, the tools at the end, as one row. */
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.label {
		flex: 1;
		min-width: 0;
		color: var(--on-surface-muted);
		font-family: var(--font-control);
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
	.tool:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.inks .tool {
		border: 1px solid var(--border);
	}
	.tool:hover:not(:disabled) {
		background: var(--surface-hover);
	}
	.tool[aria-pressed='true'] {
		background: var(--choice-selected-background);
		box-shadow: inset 0 0 0 2px var(--focus);
	}
	/* The words' own box, `rows` lines tall at first, growing with its text to most of the
	   screen and scrolling past that. */
	.field {
		box-sizing: border-box;
		min-width: 0;
		min-height: max(var(--tap-target), calc(var(--rows) * 1lh + 2 * var(--space-2)));
		max-height: 60dvh;
		overflow-y: auto;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: inherit;
		font-family: var(--font-body);
		/* iOS zooms into fields under 16px. */
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
		/* A textarea's own line height, so a note is no taller than it was. */
		line-height: 1.2;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}
	/* A card's words, in the heading font the card shows them in. */
	.display .field {
		font-family: var(--font-heading);
		font-size: 1.1rem;
		line-height: 1.3;
	}
	.field:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}
	.field[aria-disabled='true'] {
		opacity: 0.5;
	}
	/* A note's words in its row: plain text on the row, the tools over the row's first line
	   end while the words are written, and hidden (keeping no room) otherwise. */
	.inline .label {
		position: absolute;
		width: 1px; /* px-ok: screen-reader-only label */
		height: 1px; /* px-ok: screen-reader-only label */
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.inline .head {
		position: absolute;
		inset-block-start: 0;
		inset-inline-end: 0;
		height: var(--tap-target);
		visibility: hidden;
	}
	.inline.active .head {
		visibility: visible;
	}
	.inline .field {
		min-height: 1lh;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: none;
	}
	.inline .field:focus-visible {
		outline: none;
	}
	.inline .field[aria-disabled='true'] {
		opacity: 1;
	}
	/* Bold is weight, never colour (Trevor, 2026-10-16); browsers write b or strong. */
	.field :global(strong),
	.field :global(b) {
		font-weight: 900;
	}
</style>
