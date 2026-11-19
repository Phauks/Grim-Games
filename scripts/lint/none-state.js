/**
 * Lint `grim/none-state`: "None" for an empty list, section, slot or value is drawn by the
 * shared NoneState, one look everywhere (Trevor, 2026-11-19: "unify all empty null ones into
 * single format, as decided by previous None for announcements").
 *
 * Reported: the word "None" as markup text, or `{t('common.none')}` on its own, outside a
 * NoneState. Not reported: "None" as a choice (an `option`, text on a `button`, a
 * Select's or ChoiceGroup's label, an attribute), an answer in `strong`, and a value worked out
 * in script (`{name || t('common.none')}`).
 */

/** @param {any} e @returns {boolean} */
function isNoneMessage(e) {
	return (
		e?.type === 'CallExpression' &&
		e.callee.type === 'Identifier' &&
		e.callee.name === 't' &&
		e.arguments[0]?.type === 'Literal' &&
		e.arguments[0].value === 'common.none'
	);
}

/** @param {any} node */
function insideAllowed(node) {
	// An answer to give (a night step's <strong>None</strong>).
	if (node.parent?.name?.name === 'strong') return true;
	for (let el = node.parent; el && el.type !== 'Program'; el = el.parent) {
		if (el.type !== 'SvelteElement') continue;
		const name = el.name?.name;
		if (['NoneState', 'button', 'option', 'title', 'code', 'pre'].includes(name)) return true;
	}
	return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export const noneState = {
	meta: {
		type: 'problem',
		docs: { description: 'An empty state is the shared NoneState.' },
		messages: {
			use: 'Show nothing with <NoneState /> (#lib/ui/primitives/NoneState.svelte), the one look for every empty state.'
		},
		schema: []
	},
	create(context) {
		if (/\/NoneState\.svelte$/.test(context.filename)) return {};
		return {
			/** @param {any} node */
			SvelteText(node) {
				if (!Array.isArray(node.parent?.children)) return;
				if (node.value.trim() !== 'None' || insideAllowed(node)) return;
				context.report({ node, messageId: 'use' });
			},
			/** @param {any} node */
			SvelteMustacheTag(node) {
				if (node.kind !== 'text' || !Array.isArray(node.parent?.children)) return;
				if (!isNoneMessage(node.expression) || insideAllowed(node)) return;
				context.report({ node, messageId: 'use' });
			}
		};
	}
};
