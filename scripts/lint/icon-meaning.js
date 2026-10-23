/**
 * Lint `grim/icon-meaning`: one icon per meaning, picked from the catalogue (Trevor,
 * 2026-10-23: the infinite reminder's edit button was a pen, "should always be pencil, lint?
 * We should make sure that we are grabbing these icons in a good way").
 *
 * Reported:
 * - an import of an icon package (`~icons/...`, `@iconify/...`, `unplugin-icons`) outside
 *   src/lib/ui/icons/: features name a catalogue slot (`<Icon name>`, `icon=`), so every
 *   screen draws the same glyph and Settings can swap it;
 * - a button whose words say what it does (its text or `label`, written out or as `t('key')`)
 *   with a different slot's icon, such as an "Edit token" button without `icon="edit"`;
 * - a slot used outside the files that own it (`owners` option), such as the scratch pad's
 *   `pen` tool drawn as an edit button.
 */
import { attribute, attributeText, literal, visibleText } from './button-text.js';

const ICON_PACKAGE = /^(?:~icons\/|@iconify(?:-json)?\/|unplugin-icons(?:\/|$))/;

/** A button whose words start this way takes this slot (and no other). */
const MEANINGS = [{ slot: 'edit', words: /^\s*(edit|rename)\b/i }];

/** @type {import('eslint').Rule.RuleModule} */
export const iconMeaning = {
	meta: {
		type: 'problem',
		docs: { description: 'Icons come from the catalogue, one slot per meaning.' },
		messages: {
			package:
				'Icons come from the catalogue (#lib/ui/icons/catalogue.ts): use <Icon name="…"> or a button\'s icon="…", never an icon package directly.',
			meaning: 'A button that says "{{text}}" uses icon="{{slot}}", the one icon for that meaning.',
			owned:
				'The "{{slot}}" icon belongs to {{owners}}. Pick the slot for what this does (an edit button is icon="edit").'
		},
		schema: [
			{
				type: 'object',
				properties: {
					owners: {
						type: 'object',
						additionalProperties: { type: 'array', items: { type: 'string' } }
					}
				},
				additionalProperties: false
			}
		]
	},
	create(context) {
		/** @type {Record<string, string[]>} */
		const owners = context.options[0]?.owners ?? {};
		const file = context.filename.replaceAll('\\', '/');
		const inIcons = file.includes('/src/lib/ui/icons/');

		/** @param {any} node @param {unknown} slot */
		function checkOwner(node, slot) {
			if (typeof slot !== 'string') return;
			const allowed = owners[slot];
			if (!allowed || allowed.some((path) => file.includes(`/${path}`))) return;
			context.report({ node, messageId: 'owned', data: { slot, owners: allowed.join(', ') } });
		}

		return {
			/** @param {any} node */
			ImportDeclaration(node) {
				if (!inIcons && ICON_PACKAGE.test(String(node.source.value)))
					context.report({ node, messageId: 'package' });
			},
			/** @param {any} node */
			ImportExpression(node) {
				const source = node.source?.type === 'Literal' ? String(node.source.value) : '';
				if (!inIcons && ICON_PACKAGE.test(source)) context.report({ node, messageId: 'package' });
			},
			/** A slot named in script, such as a menu entry's `icon: 'notes'`. @param {any} node */
			Property(node) {
				const key = node.key?.type === 'Identifier' ? node.key.name : node.key?.value;
				if (key === 'icon' && node.value?.type === 'Literal') checkOwner(node, node.value.value);
			},
			/** @param {any} node */
			SvelteElement(node) {
				const name = node.name?.name;
				if (node.kind !== 'component' && name !== 'button') return;
				if (name === 'Icon') checkOwner(node.startTag, literal(attribute(node, 'name')));
				const icon = literal(attribute(node, 'icon'));
				if (node.kind === 'component') checkOwner(node.startTag, icon);
				const isButton = name === 'Button' || name === 'IconButton' || name === 'button';
				if (!isButton) return;
				const text = name === 'IconButton' ? attributeText(node, 'label') : visibleText(node);
				// A plain <button> shows its icon as an <Icon> child.
				const shown = name === 'button' ? childIcon(node) : icon;
				if (shown === undefined) return;
				for (const { slot, words } of MEANINGS) {
					if (words.test(text) && shown !== slot)
						context.report({ node: node.startTag, messageId: 'meaning', data: { text, slot } });
				}
			}
		};
	}
};

/** The slot of the first `<Icon name>` inside a button. @param {any} node @returns {string | undefined} */
function childIcon(node) {
	for (const child of node.children ?? []) {
		if (child.type === 'SvelteElement' && child.name?.name === 'Icon')
			return literal(attribute(child, 'name'));
		const found = childIcon(child);
		if (found !== undefined) return found;
	}
	return undefined;
}
