/**
 * Lint `grim/close-button`: a close or clear X outside the primitives is the shared
 * IconButton (`icon="close"`), never a hand-rolled <button> with the X icon. The primitives'
 * own X buttons are all `data-part="close-trigger"` (or ClearableField's X), which base.css
 * makes round with the one hover tint, so every X looks the same (Trevor, 2026-10-18: "some
 * places it is square, other places it is a circle").
 */
import { attribute, literal } from './button-text.js';

/** @param {any} node */
function hasCloseIcon(node) {
	for (const child of node.children ?? []) {
		if (
			child.type === 'SvelteElement' &&
			child.name?.name === 'Icon' &&
			literal(attribute(child, 'name')) === 'close'
		)
			return true;
		if (hasCloseIcon(child)) return true;
	}
	return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export const closeButton = {
	meta: {
		type: 'problem',
		docs: { description: 'Close and clear X buttons are the shared round IconButton.' },
		messages: {
			use: 'An X button is <IconButton icon="close" label="…"> (#lib/ui/primitives/IconButton.svelte), so its hover matches every other X.'
		},
		schema: []
	},
	create(context) {
		return {
			/** @param {any} node */
			SvelteElement(node) {
				if (node.kind !== 'html' || node.name?.name !== 'button') return;
				if (hasCloseIcon(node)) context.report({ node: node.startTag, messageId: 'use' });
			}
		};
	}
};
