/**
 * Lint `grim/count-badge`: a number the app works out (how many items, how many of a total)
 * sits in a filled CountBadge, never loose in the text (Trevor, 2026-10-27: "If a number is a
 * calculation, it should sit in a colored circle, not be loose in the air").
 *
 * Reported: a text `{…}` in markup that shows a count (`x.length`, or a name such as `count`,
 * `total`, `fooCount` or `count(x)`) standing on its own, or as "7 of 10", outside a
 * CountBadge (the shared one, or the day's filled one). Not reported: a number in a sentence
 * ("8 seats, with …"), and a value in a table or under its label (`td`, `th`, `dd`), where
 * its column or label says what it counts (a DataTable's `cell` snippet too). Catalog messages that put a count in brackets are
 * refused by `scripts/count-messages.test.ts`.
 */

const COUNT_NAME = /^(count|total|counts?|n)$|Count$|Total$/;

/** @param {any} e @returns {string | undefined} */
function nameOf(e) {
	if (!e) return undefined;
	if (e.type === 'Identifier') return e.name;
	if (e.type === 'MemberExpression' && !e.computed) return e.property.name;
	if (e.type === 'CallExpression') return nameOf(e.callee);
	return undefined;
}

/** @param {any} e @returns {boolean} */
function isCount(e) {
	if (!e) return false;
	if (e.type === 'MemberExpression' && !e.computed && e.property.name === 'length') return true;
	if (e.type === 'ChainExpression') return isCount(e.expression);
	if (e.type === 'LogicalExpression') return isCount(e.left) || isCount(e.right);
	const name = nameOf(e);
	return !!name && COUNT_NAME.test(name);
}

/** Words around it ("8 seats"): a sentence, unless they are only "of" between two counts. */
/** @param {any} node */
function inSentence(node) {
	const siblings = node.parent?.children ?? [];
	const words = siblings
		.filter((/** @type {any} */ c) => c.type === 'SvelteText')
		.map((/** @type {any} */ c) => c.value)
		.join(' ')
		.replace(/\bof\b/g, '');
	return /\p{L}/u.test(words);
}

/** @type {import('eslint').Rule.RuleModule} */
export const countBadge = {
	meta: {
		type: 'problem',
		docs: { description: 'Worked-out numbers sit in a CountBadge.' },
		messages: {
			use: 'A worked-out number sits in <CountBadge count={…}> (#lib/ui/primitives/CountBadge.svelte), never loose text.'
		},
		schema: []
	},
	create(context) {
		if (/\/CountBadge\.svelte$/.test(context.filename)) return {};
		return {
			/** @param {any} node */
			SvelteMustacheTag(node) {
				if (node.kind !== 'text' || !Array.isArray(node.parent?.children)) return;
				if (!isCount(node.expression) || inSentence(node)) return;
				for (let el = node.parent; el && el.type !== 'Program'; el = el.parent) {
					// A DataTable's `cell` snippet draws a table cell.
					if (el.type === 'SvelteSnippetBlock' && el.id?.name === 'cell') return;
					if (el.type !== 'SvelteElement') continue;
					const name = el.name?.name;
					if (['CountBadge', 'title', 'option', 'td', 'th', 'dd'].includes(name)) return;
				}
				context.report({ node, messageId: 'use' });
			}
		};
	}
};
