/* eslint-disable-next-line @typescript-eslint/ban-ts-comment -- see the next line */
// @ts-nocheck -- ESLint AST nodes from svelte-eslint-parser have no usable types here.
/**
 * Lint `grim/character-display`: a character and its ability reach the screen only through
 * the shared character components, so every screen shows them the way the Script tab does
 * (Trevor, 2026-10-30: "invoking a character ... should invoke the standard thing we use for
 * showing characters, as is seen in the script"; "lint in general when invoking characters
 * and character abilities").
 *
 * Reported:
 * - a `Character`'s `ability` (#lib/core/data/types.ts) in a Svelte template, unless it is
 *   inside a `<CharacterRow>` (its `ability` snippet). Type-aware, so other `ability` fields
 *   are not caught. Script code may still read it (search text, rules);
 * - a call to `iconUrl` or `fallbackIconUrl` (features/characters/icon-url.ts): a character's
 *   icon is drawn by CharacterRow, CharacterBadge, CharacterToken or the board's tokens;
 * - importing `CharacterSummary`, the top of the character's own page, anywhere but that page.
 *
 * The components that draw characters are the rule's ignores in eslint.config.js; files that
 * still draw their own are CHARACTER_DISPLAY_TODO there, which only shrinks.
 */

import { fileURLToPath } from 'node:url';

const TYPES_FILE = fileURLToPath(new URL('../../src/lib/core/data/types.ts', import.meta.url));
const ICON_FUNCTIONS = new Set(['iconUrl', 'fallbackIconUrl']);

/** True when a type, or one member of a union, is core's `Character`. */
function isCharacter(type) {
	if (type.isUnion()) return type.types.some(isCharacter);
	const symbol = type.getSymbol();
	if (symbol?.getName() !== 'Character') return false;
	return (symbol.declarations ?? []).some(
		(d) => d.getSourceFile().fileName.replace(/\\/g, '/') === TYPES_FILE.replace(/\\/g, '/')
	);
}

/**
 * Where a node sits in a Svelte file: `script` inside a <script>, `row` inside a
 * <CharacterRow>, `markup` elsewhere in the template, or `none` outside Svelte markup.
 */
function placeOf(node) {
	let markup = false;
	for (let at = node.parent; at; at = at.parent) {
		if (at.type === 'SvelteScriptElement') return 'script';
		if (at.type === 'SvelteElement' && at.name?.name === 'CharacterRow') return 'row';
		if (typeof at.type === 'string' && at.type.startsWith('Svelte')) markup = true;
	}
	return markup ? 'markup' : 'none';
}

/** @type {import('eslint').Rule.RuleModule} */
export const characterDisplay = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Characters and their abilities show through the shared character components.'
		},
		messages: {
			ability:
				"Show a character's ability with <CharacterRow> (#lib/features/characters/CharacterRow.svelte; pass GlossaryText in its `ability` snippet), the Script tab's look.",
			icon: "Draw a character's icon with <CharacterRow>, <CharacterBadge> or <CharacterToken>, not by hand.",
			summary:
				"CharacterSummary is the top of the character's own page (CharacterDialog); elsewhere show the character with <CharacterRow info>."
		},
		schema: []
	},
	create(context) {
		const services = context.sourceCode.parserServices;
		const checker = services?.program?.getTypeChecker();
		return {
			/** @param {any} node */
			ImportDeclaration(node) {
				if (/\/CharacterSummary\.svelte$/.test(node.source.value)) {
					context.report({ node, messageId: 'summary' });
				}
			},
			/** @param {any} node */
			CallExpression(node) {
				if (node.callee.type === 'Identifier' && ICON_FUNCTIONS.has(node.callee.name)) {
					context.report({ node, messageId: 'icon' });
				}
			},
			/** @param {any} node */
			MemberExpression(node) {
				if (node.computed || node.property?.name !== 'ability') return;
				if (!checker || !services.esTreeNodeToTSNodeMap) return;
				if (placeOf(node) !== 'markup') return;
				const tsNode = services.esTreeNodeToTSNodeMap.get(node.object);
				if (tsNode && isCharacter(checker.getTypeAtLocation(tsNode))) {
					context.report({ node, messageId: 'ability' });
				}
			}
		};
	}
};
