/**
 * Lint `grim/text-field`: a labelled text field is the shared TextField
 * (#lib/ui/primitives/TextField.svelte), never a hand-built `<label>` with an `<input>` or
 * `<textarea>` in it (component review, 2026-10-17: twelve features had their own `.field`
 * styles and Enter handlers, most without the input-method check). Checkboxes, radios,
 * ranges, files and other non-text inputs are left alone.
 */

const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'number', 'password']);

/** @param {any} node @param {string} name */
function attribute(node, name) {
	return node.startTag.attributes.find(
		(/** @type {any} */ a) => a.type === 'SvelteAttribute' && a.key?.name === name
	);
}

/** @param {any} node */
function isTextControl(node) {
	if (node.kind !== 'html') return false;
	const name = node.name?.name;
	if (name === 'textarea') return true;
	if (name !== 'input') return false;
	const type = attribute(node, 'type');
	const [value] = type?.value ?? [];
	// A dynamic type could be anything; only a written one that isn't text is skipped.
	return !type || value?.type !== 'SvelteLiteral' || TEXT_TYPES.has(value.value);
}

/** @type {import('eslint').Rule.RuleModule} */
export const textField = {
	meta: {
		type: 'problem',
		docs: { description: 'Labelled text fields use the shared TextField.' },
		messages: {
			use: 'Use <TextField label bind:value> (#lib/ui/primitives/TextField.svelte) for a labelled text field: it has the label, the clear X, Enter to commit and the field styles.'
		},
		schema: []
	},
	create(context) {
		return {
			/** @param {any} node */
			SvelteElement(node) {
				if (!isTextControl(node)) return;
				let parent = node.parent;
				while (parent) {
					if (
						parent.type === 'SvelteElement' &&
						parent.kind === 'html' &&
						parent.name?.name === 'label'
					) {
						context.report({ node: node.startTag, messageId: 'use' });
						return;
					}
					parent = parent.parent;
				}
			}
		};
	}
};
