/** What a button says, for the `grim/*` rules that judge buttons by their words. */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CATALOG = fileURLToPath(new URL('../../src/lib/i18n/messages/en/', import.meta.url));

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
export function attribute(node, name) {
	return node.startTag.attributes.find(
		(/** @type {any} */ a) => a.type === 'SvelteAttribute' && a.key?.name === name
	);
}

/** @param {any} attr */
export function literal(attr) {
	const [value] = attr?.value ?? [];
	return value?.type === 'SvelteLiteral' ? value.value : undefined;
}

/**
 * The button's visible text, as far as it can be read: literal text and `t('key')`.
 * @param {any} node
 */
export function visibleText(node) {
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

/**
 * What an attribute such as IconButton's `label` says, as far as it can be read: a literal,
 * or `{t('key')}` / `{t('key', params)}` looked up in the English catalog.
 * @param {any} node @param {string} name
 */
export function attributeText(node, name) {
	const [value] = attribute(node, name)?.value ?? [];
	if (value?.type === 'SvelteLiteral') return value.value.trim();
	const e = value?.type === 'SvelteMustacheTag' ? value.expression : undefined;
	if (e?.type === 'Literal' && typeof e.value === 'string') return e.value.trim();
	if (
		e?.type === 'CallExpression' &&
		e.callee.type === 'Identifier' &&
		e.callee.name === 't' &&
		e.arguments[0]?.type === 'Literal'
	)
		return (message(e.arguments[0].value) ?? '').trim();
	return '';
}
