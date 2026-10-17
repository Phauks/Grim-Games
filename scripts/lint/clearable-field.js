/**
 * Lint `grim/clearable-field`: every single-line field people type into has an X that
 * clears it (Trevor, 2026-10-16: "for filters or any text box with custom entry, lint so
 * it has an x to remove that text"). An `<input>` of type text, search, email, url or tel
 * (or with no type) must sit directly inside a <ClearableField>. Read-only fields and
 * multi-line notes (`<textarea>`, so one tap can't wipe a long note) are left alone.
 */

const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel']);

/** @param {any} node @param {string} name */
function attribute(node, name) {
	return node.startTag.attributes.find(
		(/** @type {any} */ a) => a.type === 'SvelteAttribute' && a.key?.name === name
	);
}

/** @type {import('eslint').Rule.RuleModule} */
export const clearableField = {
	meta: {
		type: 'problem',
		docs: { description: 'Text fields sit in a ClearableField, so they have an X.' },
		messages: {
			use: 'A text field needs an X that clears it: wrap it in <ClearableField bind:value> (#lib/ui/primitives/ClearableField.svelte).'
		},
		schema: []
	},
	create(context) {
		if (context.filename.endsWith('ClearableField.svelte')) return {};
		return {
			/** @param {any} node */
			SvelteElement(node) {
				if (node.kind !== 'html' || node.name?.name !== 'input') return;
				if (attribute(node, 'readonly')) return;
				const type = attribute(node, 'type');
				const [value] = type?.value ?? [];
				if (type && value?.type === 'SvelteLiteral' && !TEXT_TYPES.has(value.value)) return;
				// The nearest element around it, past {#if} and other blocks.
				let parent = node.parent;
				while (parent && parent.type !== 'SvelteElement') parent = parent.parent;
				if (parent?.kind === 'component' && parent.name?.name === 'ClearableField') return;
				context.report({ node: node.startTag, messageId: 'use' });
			}
		};
	}
};
