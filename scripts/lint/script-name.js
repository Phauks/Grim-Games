/**
 * Lint `grim/script-name`: a script's name, with its logo, is the one ScriptName component
 * (Trevor, 2026-10-31: "How many different ways do we iterate a script name? It probably
 * should just be one component"). Importing the logo (`ScriptLogo`) or the name drawn as a
 * logo (`ScriptNameMark`) outside the components that own them means a hand-built copy.
 * The owners are listed in eslint.config.js: ScriptName, and the logo standing on its own
 * (BoardLogo, CoverScreen, ScriptQrCenter, the printed sheet).
 */

const PARTS = ['ScriptLogo.svelte', 'ScriptNameMark.svelte'];

/** @type {import('eslint').Rule.RuleModule} */
export const scriptName = {
	meta: {
		type: 'problem',
		docs: { description: "A script's name and logo show through ScriptName." },
		messages: {
			use: "Show a script's name with #lib/features/scripts/ScriptName.svelte (size 'title', 'row' or 'lead') instead of {{part}}."
		},
		schema: []
	},
	create(context) {
		return {
			/** @param {any} node */
			ImportDeclaration(node) {
				const source = String(node.source.value);
				const part = PARTS.find((p) => source === `./${p}` || source.endsWith(`/${p}`));
				if (part) context.report({ node, messageId: 'use', data: { part } });
			}
		};
	}
};
