/**
 * Lint `grim/rules-for`: game rules and the engine read a character's rules only through
 * `rulesFor` (core/rules/rules-for.ts), which lays the game's optional rules and jinx patches
 * over its block. The static readers in core/data/rules/index.ts (`rulesOf`, `rulesIn`,
 * `rulesOfCharacter`) ignore jinx patches, so a jinx that patches a part only worked where its
 * reader happened to be game-aware (refactor review D1, 2026-11-11).
 *
 * Code that reads rules before or outside a game (setup, the night sheet, Reference, the
 * jinx readers `rulesFor` itself is built on) is the rule's ignores in eslint.config.js;
 * files not moved yet are RULES_OF_TODO there, which only shrinks.
 */

const STATIC_READERS = new Set(['rulesOf', 'rulesIn', 'rulesOfCharacter']);

/** @type {import('eslint').Rule.RuleModule} */
export const rulesFor = {
	meta: {
		type: 'problem',
		docs: { description: 'Game rules read a character rules through rulesFor.' },
		messages: {
			use: "Read rules in a game with rulesFor(game, id, characters) from '#lib/core/rules/rules-for.ts', not {{name}}, so jinx patches and optional rules apply."
		},
		schema: []
	},
	create(context) {
		return {
			/** @param {any} node */
			ImportDeclaration(node) {
				if (!/\/data\/rules\/index\.ts$/.test(String(node.source.value))) return;
				for (const s of node.specifiers) {
					const name = s.type === 'ImportSpecifier' ? s.imported.name : undefined;
					if (name && STATIC_READERS.has(name)) {
						context.report({ node: s, messageId: 'use', data: { name } });
					}
				}
			}
		};
	}
};
