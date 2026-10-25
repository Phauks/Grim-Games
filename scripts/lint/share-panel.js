/**
 * Lint `grim/share-panel`: every Share opens the one share screen, `ui/share/SharePanel`,
 * with its QR code, link, Copy and Share (Trevor, 2026-10-23: "make sure they are all the
 * same"). Only the share screen calls the phone's own share sheet (`navigator.share` or
 * `navigator.canShare`), so no button can skip it.
 */

/** @type {import('eslint').Rule.RuleModule} */
export const sharePanel = {
	meta: {
		type: 'problem',
		docs: { description: 'Sharing goes through the one share screen, ui/share/SharePanel.' },
		messages: {
			use: 'Open the share screen (#lib/ui/share/SharePanel.svelte, or features/scripts/ShareControl for a script) instead of calling navigator.{{name}}.'
		},
		schema: []
	},
	create(context) {
		return {
			/** @param {any} node */
			MemberExpression(node) {
				if (node.object?.type !== 'Identifier' || node.object.name !== 'navigator') return;
				const name = node.property?.type === 'Identifier' ? node.property.name : undefined;
				if (name === 'share' || name === 'canShare') {
					context.report({ node, messageId: 'use', data: { name } });
				}
			}
		};
	}
};
