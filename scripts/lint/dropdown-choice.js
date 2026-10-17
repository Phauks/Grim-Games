/**
 * Lint `grim/dropdown-choice`: one choice among a few options is a dropdown (Select), not
 * a row of toggle buttons (Trevor, 2026-10-17: "Lets not do the two button toggles. When
 * possible, just do dropdowns").
 *
 * Reported:
 * - importing Ark's segment group or toggle group;
 * - a hand-built radio group (`role="radio"` or `role="radiogroup"`);
 * - sibling buttons pressed by comparing one value with different options
 *   (`aria-pressed={tool === 'pen'}` beside `aria-pressed={tool === 'eraser'}`);
 * - a ChoiceGroup with three or fewer options written out.
 * On/off switches (Toggle) and multi-select chips are not choices of one and stay.
 */
const TOGGLE_IMPORTS = /^@ark-ui\/svelte\/(segment-group|toggle-group)$/;

/** @param {any} node @param {string} name */
function attribute(node, name) {
	return node.startTag.attributes.find(
		(/** @type {any} */ a) => a.type === 'SvelteAttribute' && a.key?.name === name
	);
}

/**
 * The value an `aria-pressed={x === 'option'}` compares, as source text, if it is one.
 * @param {any} node @param {import('eslint').SourceCode} source
 */
function pressedBy(node, source) {
	const value = attribute(node, 'aria-pressed')?.value?.[0];
	const e = value?.type === 'SvelteMustacheTag' ? value.expression : undefined;
	if (e?.type !== 'BinaryExpression' || e.operator !== '===') return undefined;
	if (e.right.type === 'Literal') return source.getText(e.left);
	if (e.left.type === 'Literal') return source.getText(e.right);
	return undefined;
}

/** @param {any} node */
function isButton(node) {
	const name = node.name?.name;
	return (
		(node.kind === 'html' && name === 'button') || (node.kind === 'component' && name === 'Button')
	);
}

/** @type {import('eslint').Rule.RuleModule} */
export const dropdownChoice = {
	meta: {
		type: 'problem',
		docs: { description: 'A choice of one among a few options is a Select, not toggle buttons.' },
		messages: {
			use: 'One choice among a few options is a dropdown: <Select> (#lib/ui/primitives/Select.svelte), not toggle buttons.'
		},
		schema: []
	},
	create(context) {
		const source = context.sourceCode;
		return {
			/** @param {any} node */
			ImportDeclaration(node) {
				if (TOGGLE_IMPORTS.test(node.source.value)) context.report({ node, messageId: 'use' });
			},
			/** @param {any} node */
			SvelteElement(node) {
				if (node.kind === 'html') {
					const role = attribute(node, 'role')?.value?.[0];
					if (role?.type === 'SvelteLiteral' && /^radio(group)?$/.test(role.value))
						context.report({ node: node.startTag, messageId: 'use' });
				}
				if (node.kind === 'component' && node.name?.name === 'ChoiceGroup') {
					const options = attribute(node, 'options')?.value?.[0];
					const e = options?.type === 'SvelteMustacheTag' ? options.expression : undefined;
					if (e?.type === 'ArrayExpression' && e.elements.length <= 3)
						context.report({ node: node.startTag, messageId: 'use' });
				}
				// Sibling buttons pressed by the same value: report the second and later ones.
				const seen = new Set();
				for (const child of node.children ?? []) {
					if (child.type !== 'SvelteElement' || !isButton(child)) continue;
					const by = pressedBy(child, source);
					if (by === undefined) continue;
					if (seen.has(by)) context.report({ node: child.startTag, messageId: 'use' });
					seen.add(by);
				}
			}
		};
	}
};
