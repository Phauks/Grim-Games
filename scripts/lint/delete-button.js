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
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CATALOG = fileURLToPath(new URL('../../src/lib/i18n/messages/en/', import.meta.url));
const DESTRUCTIVE = /^\s*(delete|remove|clear)\b/i;

/** English text by message key, read from the catalog files (plain `'key': 'text'` lines). */
/** @type {Map<string, string> | undefined} */
let catalog;
/** @param {string} key */
function message(key) {
	if (!catalog) {
		catalog = new Map();
		for (const file of readdirSync(CATALOG)) {
			if (!file.endsWith('.ts')) continue;
			const text = readFileSync(CATALOG + file, 'utf8');
			for (const m of text.matchAll(/'([\w.-]+)':\s*(['"`])((?:\\.|(?!\2).)*)\2/g))
				catalog.set(m[1], m[3]);
		}
	}
	return catalog.get(key);
}

/** @param {any} node @param {string} name */
function attribute(node, name) {
	return node.startTag.attributes.find(
		(/** @type {any} */ a) => a.type === 'SvelteAttribute' && a.key?.name === name
	);
}

/** @param {any} attr */
function literal(attr) {
	const [value] = attr?.value ?? [];
	return value?.type === 'SvelteLiteral' ? value.value : undefined;
}

/**
 * The button's visible text, as far as it can be read: literal text and `t('key')`.
 * @param {any} node
 */
function visibleText(node) {
	let out = '';
	for (const child of node.children ?? []) {
		if (child.type === 'SvelteText') out += child.value;
		else if (child.type === 'SvelteMustacheTag') {
			const e = child.expression;
			if (e.type === 'Literal' && typeof e.value === 'string') out += e.value;
			else if (
				e.type === 'CallExpression' &&
				e.callee.type === 'Identifier' &&
				e.callee.name === 't' &&
				e.arguments[0]?.type === 'Literal'
			)
				out += message(e.arguments[0].value) ?? '';
		}
	}
	return out.trim();
}

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
