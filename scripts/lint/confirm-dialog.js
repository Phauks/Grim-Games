/**
 * Lint `grim/confirm-dialog`: every confirmation is a ConfirmDialog, whose buttons always
 * say Cancel and Confirm (Trevor, 2026-10-16: "change change to confirm. lint for confirm
 * for actions"). A dialog with `role="alertdialog"` anywhere else is reported, since its
 * action button could say anything.
 */

/** @type {import('eslint').Rule.RuleModule} */
export const confirmDialog = {
	meta: {
		type: 'problem',
		docs: { description: 'Confirmations use ConfirmDialog, whose action says Confirm.' },
		messages: {
			use: 'A confirmation must be a <ConfirmDialog> (#lib/ui/primitives/ConfirmDialog.svelte), so its button says Confirm.'
		},
		schema: []
	},
	create(context) {
		if (context.filename.endsWith('ConfirmDialog.svelte')) return {};
		return {
			/** @param {any} node */
			SvelteAttribute(node) {
				if (node.key?.name !== 'role') return;
				const [value] = node.value ?? [];
				if (value?.type === 'SvelteLiteral' && value.value === 'alertdialog')
					context.report({ node, messageId: 'use' });
			}
		};
	}
};
