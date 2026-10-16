/* eslint-disable-next-line @typescript-eslint/ban-ts-comment -- see the next line */
// @ts-nocheck -- ESLint AST nodes from svelte-eslint-parser have no usable types here.
/**
 * Lint `grim/names-as-badges`: a character name or reminder token text never reaches the
 * screen as plain text. It is shown as a CharacterBadge or ReminderToken (Trevor,
 * 2026-10-16: "when reminder or character names are invoked, they should always show").
 *
 * Type-aware. `Character.name` is a `CharacterName` and reminder texts (`Reminder.label`,
 * `Character.reminders`) are `ReminderLabel`, both marked strings (#lib/core/data/types.ts),
 * so the mark follows a name through variables, `{#each}` blocks and function returns.
 * The rule reports a marked value where it turns into plain text:
 * - `{name}` as text in a Svelte template;
 * - inside a template literal, a `+` string concatenation or `.join()`;
 * - as a placeholder of a catalog message (`t()`, `say()`, `formatMessage()`), since
 *   catalog text is plain.
 *
 * Plain text is fine where it cannot be a badge: `aria-*` labels, `alt`, `title`
 * tooltips, `placeholder`, `value`, an IconButton's `label` (its accessible name) and
 * `<title>` / `<svelte:head>` and a native `<option>`. Anything else plain must carry an eslint-disable comment
 * saying why.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const LIB = fileURLToPath(new URL('../../src/lib/', import.meta.url));
/** Props typed `CharacterName` or `ReminderLabel` in a component file, by path. */
const markedPropsCache = new Map();
function markedProps(file) {
	let props = markedPropsCache.get(file);
	if (props) return props;
	props = new Set();
	try {
		const source = readFileSync(file, 'utf8');
		for (const match of source.matchAll(/(\w+)\??:\s*(?:CharacterName|ReminderLabel)\b/g))
			props.add(match[1]);
	} catch {
		// Unreadable component: no marked props, so names passed to it are reported.
	}
	markedPropsCache.set(file, props);
	return props;
}

const MARKS = { CharacterNameMark: 'character name', ReminderLabelMark: 'reminder name' };
const FIX = {
	'character name': 'a <CharacterBadge>',
	'reminder name': 'a <ReminderToken>'
};

/** Attributes that only ever hold plain text (accessible names, tooltips, inputs). */
const PLAIN_ATTRIBUTES = new Set([
	'aria-label',
	'aria-description',
	'aria-valuetext',
	'aria-roledescription',
	'alt',
	'title',
	'placeholder',
	'value'
]);
/** Component props that are accessible names only (`IconButton`'s `label`). */
const PLAIN_PROPS = { IconButton: new Set(['label']) };
const MESSAGE_FUNCTIONS = new Set(['t', 'say', 'formatMessage']);

/** @param {import('typescript').Type} type */
function markOf(type) {
	if (type.isUnion()) {
		for (const part of type.types) {
			const mark = markOf(part);
			if (mark) return mark;
		}
		return undefined;
	}
	if (type.isIntersection()) {
		for (const part of type.types) {
			const name = part.getSymbol()?.getName();
			if (name && name in MARKS) return MARKS[/** @type {keyof typeof MARKS} */ (name)];
		}
	}
	return undefined;
}

/**
 * True when the node sits where only plain text can go, or in a component prop that draws
 * the badge itself (`isBadgeProp`).
 */
function inPlainContext(node, isBadgeProp) {
	for (let at = node.parent; at; at = at.parent) {
		if (at.type === 'SvelteAttribute' || at.type === 'SvelteShorthandAttribute') {
			const name = at.key?.name;
			const element = at.parent?.parent;
			if (typeof name !== 'string') return false;
			// On a component, `title` or `value` may well be shown as text (a Dialog title).
			if (element?.kind !== 'component') return PLAIN_ATTRIBUTES.has(name);
			if (name.startsWith('aria-')) return true;
			const tag = element.name?.name;
			if (typeof tag === 'string' && PLAIN_PROPS[tag]?.has(name)) return true;
			return isBadgeProp(element, name);
		}
		if (at.type === 'SvelteElement') {
			const tag = at.name?.name;
			// A native <select>'s options can only hold text.
			if (tag === 'title' || tag === 'svelte:head' || tag === 'option') return true;
		}
		if (at.type === 'SvelteHTMLComment' || at.type === 'Program') return false;
	}
	return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export const namesAsBadges = {
	meta: {
		type: 'problem',
		docs: { description: 'Character and reminder names are shown as badges, not plain text.' },
		messages: {
			plain:
				'A {{kind}} shown as plain text. Render it as {{fix}} (Trevor: names always show as badges).',
			lost: 'This type drops the {{kind}} mark, so the lint loses track of it. Type it as {{type}}.'
		},
		// `{ plainText: false }` (core): only check that fields keep the marks, since core
		// builds no screen text of its own beyond rule sentences.
		schema: [
			{
				type: 'object',
				properties: { plainText: { type: 'boolean' } },
				additionalProperties: false
			}
		]
	},
	create(context) {
		const plainText = context.options[0]?.plainText !== false;
		const services = context.sourceCode.parserServices;
		if (!services?.program || !services.esTreeNodeToTSNodeMap) return {};
		const checker = services.program.getTypeChecker();

		/** The initialiser of the `const` an identifier names, if it is one. */
		function constInit(identifier) {
			let scope = context.sourceCode.getScope(identifier);
			for (; scope; scope = scope.upper) {
				const variable = scope.set.get(identifier.name);
				if (!variable) continue;
				const def = variable.defs[0];
				if (def?.type !== 'Variable' || def.parent?.kind !== 'const') return undefined;
				if (def.node.id.type !== 'Identifier') return undefined;
				return def.node.init ?? undefined;
			}
			return undefined;
		}

		/** The mark on the node's type, if any. */
		function mark(node, depth = 0) {
			// `character?.name ?? id` is typed `string` (the union absorbs the mark), but it
			// is still a name on screen: follow either branch.
			if (node.type === 'LogicalExpression')
				return mark(node.left, depth) ?? mark(node.right, depth);
			if (node.type === 'ConditionalExpression')
				return mark(node.consequent, depth) ?? mark(node.alternate, depth);
			if (node.type === 'ChainExpression') return mark(node.expression);
			// …and through a `const` holding one (`const who = character?.name ?? id`).
			if (node.type === 'Identifier' && depth < 4) {
				const init = constInit(node);
				if (init) {
					const found = mark(init, depth + 1);
					if (found) return found;
				}
			}
			const tsNode = services.esTreeNodeToTSNodeMap.get(node);
			if (!tsNode) return undefined;
			return markOf(checker.getTypeAtLocation(tsNode));
		}

		function importedSvelteFile(local) {
			// In a .svelte file the imports sit inside its <script> elements.
			const statements = context.sourceCode.ast.body.flatMap((node) =>
				node.type === 'SvelteScriptElement' ? node.body : [node]
			);
			for (const statement of statements) {
				if (statement.type !== 'ImportDeclaration') continue;
				if (!statement.specifiers.some((s) => s.local.name === local)) continue;
				const source = String(statement.source.value);
				if (!source.endsWith('.svelte')) return undefined;
				if (source.startsWith('#lib/')) return join(LIB, source.slice('#lib/'.length));
				if (source.startsWith('.')) return resolve(dirname(context.filename), source);
				return undefined;
			}
			return undefined;
		}

		/**
		 * True when a component's prop is typed as a marked name, so the component draws the
		 * badge (ReminderToken's `label`, CharacterBadge's `text`). ESLint's TypeScript program
		 * sees `.svelte` imports only as a generic component, so this reads the imported
		 * component's `Props` instead.
		 */
		function propIsMarked(element, prop) {
			const tag = element.name?.name;
			if (typeof tag !== 'string') return false;
			const file = importedSvelteFile(tag);
			return Boolean(file && markedProps(file).has(prop));
		}

		function check(node, at = node) {
			const kind = mark(node);
			if (!kind || inPlainContext(at, propIsMarked)) return;
			context.report({ node, messageId: 'plain', data: { kind, fix: FIX[kind] } });
		}

		/** A marked value stored in a field typed as a plain string loses its mark. */
		function keepsMark(node) {
			const kind = mark(node);
			if (!kind) return;
			const tsNode = services.esTreeNodeToTSNodeMap.get(node);
			const target = tsNode && checker.getContextualType(tsNode);
			if (!target || markOf(target)) return;
			if (!(target.flags & ts.TypeFlags.String)) return;
			const type = kind === 'character name' ? 'CharacterName' : 'ReminderLabel';
			context.report({ node, messageId: 'lost', data: { kind, type } });
		}

		const fields = {
			Property(node) {
				if (node.parent?.type === 'ObjectExpression' && !node.computed) keepsMark(node.value);
			},
			ReturnStatement(node) {
				if (node.argument) keepsMark(node.argument);
			},
			ArrowFunctionExpression(node) {
				if (node.body.type !== 'BlockStatement' && node.returnType) keepsMark(node.body);
			},
			VariableDeclarator(node) {
				if (node.init && node.id.typeAnnotation) keepsMark(node.init);
			}
		};
		if (!plainText) return fields;

		return {
			...fields,
			SvelteMustacheTag(node) {
				if (node.kind !== 'text') return;
				const attribute = node.parent;
				// A whole attribute value on an HTML element is not text on the screen
				// (`data-*`, `href`); one on a component is checked, since a plain string prop
				// shows the name as text. `text="{name}: …"` builds a string, so it is checked.
				if (
					attribute?.type === 'SvelteAttribute' &&
					attribute.value.length === 1 &&
					attribute.parent?.parent?.kind !== 'component'
				)
					return;
				check(node.expression, node);
			},
			TemplateLiteral(node) {
				if (node.parent?.type === 'TaggedTemplateExpression') return;
				for (const expression of node.expressions) check(expression, node);
			},
			BinaryExpression(node) {
				if (node.operator !== '+') return;
				check(node.left, node);
				check(node.right, node);
			},
			CallExpression(node) {
				const callee = node.callee;
				if (
					callee.type === 'MemberExpression' &&
					!callee.computed &&
					callee.property.name === 'join'
				) {
					const tsNode = services.esTreeNodeToTSNodeMap.get(callee.object);
					const type = tsNode && checker.getTypeAtLocation(tsNode);
					const element = type && checker.isArrayType(type) && checker.getTypeArguments(type)[0];
					const kind = element && markOf(element);
					if (kind && !inPlainContext(node, propIsMarked))
						context.report({ node, messageId: 'plain', data: { kind, fix: FIX[kind] } });
					return;
				}
				if (callee.type === 'Identifier' && MESSAGE_FUNCTIONS.has(callee.name)) {
					for (const argument of node.arguments) {
						if (argument.type !== 'ObjectExpression') continue;
						for (const property of argument.properties)
							if (property.type === 'Property') check(property.value, node);
					}
				}
			}
		};
	}
};

export default { rules: { 'names-as-badges': namesAsBadges } };
