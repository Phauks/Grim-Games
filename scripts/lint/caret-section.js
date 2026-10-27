/**
 * Lint `grim/caret-section`: anything that opens and closes from a caret is the shared
 * Collapsible, so every one has the same indent, spacing, count badge and the line that
 * separates it from its neighbours (Trevor, 2026-10-27: "There should always be a delineator
 * between anything that has a carrot menu, lint for this"; "All these seem to use different
 * indents and stuff. Should use same").
 *
 * Reported, outside Collapsible.svelte: the caret (`<Icon name="expand">`, or an IconButton
 * with `icon="expand"`) on or inside an element with `aria-expanded`. A drop-down's caret
 * (`aria-haspopup`: a menu, list box or popover) opens a menu, not a section, and is allowed.
 * The line itself is checked on the drawn screens by `e2e/caret-dividers.e2e.ts`.
 */
import { attribute, literal } from './button-text.js';

/** @param {any} node */
const isCaret = (node) =>
	node.type === 'SvelteElement' &&
	((node.name?.name === 'Icon' && literal(attribute(node, 'name')) === 'expand') ||
		(node.name?.name === 'IconButton' && literal(attribute(node, 'icon')) === 'expand'));

/** @type {import('eslint').Rule.RuleModule} */
export const caretSection = {
	meta: {
		type: 'problem',
		docs: { description: 'A section that opens from a caret is the shared Collapsible.' },
		messages: {
			use: 'Something that opens and closes from a caret is <Collapsible> (#lib/ui/primitives/Collapsible.svelte): one indent, one count badge, and a line between it and its neighbours (put stacked ones in <SectionStack>).'
		},
		schema: []
	},
	create(context) {
		if (context.filename.endsWith('/Collapsible.svelte')) return {};
		return {
			/** @param {any} node */
			SvelteElement(node) {
				if (!isCaret(node)) return;
				for (let el = node; el && el.type !== 'Program'; el = el.parent) {
					if (el.type !== 'SvelteElement') continue;
					if (attribute(el, 'aria-haspopup')) return;
					if (attribute(el, 'aria-expanded')) {
						context.report({ node: node.startTag, messageId: 'use' });
						return;
					}
				}
			}
		};
	}
};
