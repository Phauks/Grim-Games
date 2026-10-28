import { parse } from 'svelte/compiler';

/**
 * Finds interface text written straight into a Svelte template, which a translation can
 * never reach: text between tags, and the text attributes people read or hear. Expressions
 * (`{t('…')}`, `{name}`) are not text and are skipped, as are <script>, <style>, <code>
 * and <pre>, and text with no letters (punctuation, numbers, "×").
 */
const TEXT_ATTRIBUTES = ['aria-label', 'aria-description', 'title', 'placeholder', 'alt', 'label'];
const SKIPPED_ELEMENTS = new Set(['code', 'pre', 'svg']);
const WORD = /\p{L}{2,}/u;

export interface HardcodedText {
	text: string;
	/** 1-based line in the file. */
	line: number;
}

interface Node {
	type?: string;
	name?: string;
	data?: string;
	start?: number;
	value?: unknown;
	attributes?: Node[];
	[key: string]: unknown;
}

export function findHardcodedText(source: string): HardcodedText[] {
	const ast = parse(source, { modern: true }) as unknown as { fragment: Node };
	const found: HardcodedText[] = [];
	const lineOf = (offset: number) => source.slice(0, offset).split('\n').length;
	const add = (text: string, start: number) => {
		const trimmed = text.replace(/\s+/g, ' ').trim();
		if (WORD.test(trimmed)) found.push({ text: trimmed, line: lineOf(start) });
	};

	const visit = (node: unknown): void => {
		if (Array.isArray(node)) {
			for (const child of node) visit(child);
			return;
		}
		if (!node || typeof node !== 'object') return;
		const n = node as Node;
		if (n.type === 'RegularElement' && n.name && SKIPPED_ELEMENTS.has(n.name)) return;
		if (n.type === 'Text' && typeof n.data === 'string') add(n.data, n.start ?? 0);
		if (
			n.type === 'Attribute' &&
			n.name &&
			TEXT_ATTRIBUTES.includes(n.name) &&
			Array.isArray(n.value)
		) {
			for (const part of n.value as Node[]) {
				if (part.type === 'Text' && typeof part.data === 'string') add(part.data, part.start ?? 0);
			}
			return;
		}
		for (const [key, child] of Object.entries(n)) {
			// Attribute text is handled above; other attributes (class, href, data-*) are not text.
			if (key === 'attributes') {
				for (const attribute of (child as Node[]) ?? []) {
					if (
						attribute.type === 'Attribute' &&
						attribute.name &&
						TEXT_ATTRIBUTES.includes(attribute.name)
					)
						visit(attribute);
					else if (attribute.type !== 'Attribute') visit(attribute);
				}
				continue;
			}
			if (key === 'value' || key === 'expression' || key === 'metadata') continue;
			if (child && typeof child === 'object') visit(child);
		}
	};
	visit(ast.fragment);
	return found;
}
