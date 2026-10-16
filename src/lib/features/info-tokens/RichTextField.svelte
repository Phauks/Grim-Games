<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
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
	/** The colour at the caret; undefined is the card's own text colour. */
	let ink = $state<InkColor>();
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
	 * The colour an element gives its text: our own mark, or a colour the browser wrote
	 * (a style or a font tag) matched to the palette. Any other colour is none.
	 */
	function inkOf(element: HTMLElement, inks: Map<string, InkColor>): InkColor | null | undefined {
		const own = element.dataset.ink;
		if (own && (INK_COLORS as readonly string[]).includes(own)) return own as InkColor;
		const written = element.style.color || element.getAttribute('color');
		if (!written) return undefined;
		const probe = document.createElement('span');
		probe.style.color = written;
		// eslint-disable-next-line svelte/no-dom-manipulating -- a probe, removed at once
		field?.append(probe);
		const color = inks.get(getComputedStyle(probe).color);
		probe.remove();
		return color ?? null;
	}

	/** Reads the formatted text back as runs (the browser writes b/strong/i/em or styles). */
	function runsOf(root: Node): TextRun[] {
		const runs: TextRun[] = [];
		const inks = resolvedInks();
		const walk = (node: Node, isBold: boolean, isItalic: boolean, color?: InkColor) => {
			if (node.nodeType === Node.TEXT_NODE) {
				runs.push({
					text: node.textContent ?? '',
					bold: isBold,
					italic: isItalic,
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
			const own = inkOf(node, inks);
			const nextColor = own === null ? undefined : (own ?? color);
			node.childNodes.forEach((child) => walk(child, nextBold, nextItalic, nextColor));
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
		ink = inkAtCaret();
	}

	function inkAtCaret(): InkColor | undefined {
		const inks = resolvedInks();
		let node: Node | null = document.getSelection()?.anchorNode ?? null;
		while (node && node !== field) {
			if (node instanceof HTMLElement) {
				const color = inkOf(node, inks);
				if (color !== undefined) return color ?? undefined;
			}
			node = node.parentNode;
		}
		return undefined;
	}

	function format(command: 'bold' | 'italic') {
		field?.focus();
		// execCommand is the only way to format a selection in an editable field everywhere.
		document.execCommand(command);
		syncButtons();
		read();
	}

	/** Colours the selection (or what is typed next); undefined goes back to the text colour. */
	function colour(color: InkColor | undefined) {
		if (!field) return;
		field.focus();
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

<div class="rich">
	<div class="tools" role="toolbar" aria-label={t('info-tokens.formatting')}>
		<!-- Weight and slant, then colour: separate groups, each doing only what it says. -->
		<div class="group" role="group" aria-label={t('info-tokens.style')}>
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
		<div class="group" role="group" aria-label={t('info-tokens.colour')}>
			<button
				type="button"
				class="tool swatch"
				aria-label={t('info-tokens.colourNone')}
				aria-pressed={ink === undefined}
				onpointerdown={(e) => e.preventDefault()}
				onclick={() => colour(undefined)}><span class="letter">A</span></button
			>
			{#each INK_COLORS as color (color)}
				<button
					type="button"
					class="tool swatch"
					aria-label={t(`info-tokens.colours.${color}`)}
					aria-pressed={ink === color}
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => colour(color)}
					><span class="letter" style:color={INK_TOKENS[color]}>A</span><span
						class="bar"
						style:background={INK_TOKENS[color]}
					></span></button
				>
			{/each}
		</div>
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
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-3);
	}
	.group {
		display: flex;
		gap: var(--space-1);
	}
	.swatch {
		position: relative;
		font-weight: 900;
	}
	/* The colour under the letter, so a colour reads even where it is close to the background. */
	.bar {
		position: absolute;
		inset-inline: 20%;
		bottom: 15%;
		height: 12%;
		border-radius: var(--radius-sm);
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
	/* Bold is weight, never colour (Trevor, 2026-10-16); browsers write b or strong. */
	.field :global(strong),
	.field :global(b) {
		font-weight: 900;
	}
</style>
