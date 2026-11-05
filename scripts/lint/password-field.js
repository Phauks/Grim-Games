/**
 * Lint `grim/password-field`: only the account's own password fields are `type="password"`
 * (Trevor, 2026-11-05: "only real password screen should be the login"). Password managers
 * offer to save whatever a password field holds, so a room's Grim view password or any
 * other changing secret is a TextField `type="secret"`, and codes and PINs a CodeField.
 * The files allowed to keep one are listed beside the rule in eslint.config.js.
 */

/** @type {import('eslint').Rule.RuleModule} */
export const passwordField = {
	meta: {
		type: 'problem',
		docs: { description: 'Only account password fields use type="password".' },
		messages: {
			use: 'Only an account password is type="password". Use TextField type="secret" for another masked value, or CodeField for a code or PIN, so password managers leave it alone.'
		},
		schema: []
	},
	create(context) {
		return {
			/** @param {any} node */
			SvelteAttribute(node) {
				if (node.key?.name !== 'type') return;
				const [value] = node.value ?? [];
				if (value?.type === 'SvelteLiteral' && value.value === 'password') {
					context.report({ node, messageId: 'use' });
				}
			}
		};
	}
};
