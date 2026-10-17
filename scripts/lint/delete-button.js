/**
 * Lint `grim/delete-button`: every delete, remove or clear is the red trash can
 * (DeleteButton), never a text button (Trevor, 2026-10-17: "Change remove from game to
 * just trashcan icon. Can we please lint so all deletes are just that way").
 *
 * Reported, outside DeleteButton.svelte:
 * - any button (Button, IconButton or <button>) with the trash icon (`icon="remove"`);
 * - a Button or <button> whose text starts with Delete, Remove or Clear, written out or as
 *   a catalog message (`t('key')`, looked up in the English catalog).
 * Not reported: ConfirmDialog's Confirm (it says Confirm) and ClearableField's X (it clears
 * a text field, with an X, not a trash can).
 */
import { attribute, literal, visibleText } from './button-text.js';

const DESTRUCTIVE = /^\s*(delete|remove|clear)\b/i;

/** @type {import('eslint').Rule.RuleModule} */
export const deleteButton = {
	meta: {
		type: 'problem',
		docs: { description: 'Deletes, removes and clears are the red trash DeleteButton.' },
		messages: {
			use: 'A delete, remove or clear must be the red trash can: <DeleteButton label="…"> (#lib/ui/primitives/DeleteButton.svelte).'
		},
		schema: []
	},
	create(context) {
		if (context.filename.endsWith('DeleteButton.svelte')) return {};
		return {
			/** @param {any} node */
			SvelteElement(node) {
				const name = node.name?.name;
				const isButton =
					(node.kind === 'component' && (name === 'Button' || name === 'IconButton')) ||
					(node.kind === 'html' && name === 'button');
				if (!isButton) return;
				const trash = literal(attribute(node, 'icon')) === 'remove';
				const text = name === 'IconButton' ? '' : visibleText(node);
				if (trash || DESTRUCTIVE.test(text))
					context.report({ node: node.startTag, messageId: 'use' });
			}
		};
	}
};
