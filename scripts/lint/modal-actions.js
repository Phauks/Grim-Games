/**
 * Lint `grim/modal-actions`: a modal where the Storyteller decides something ends in Cancel
 * and Confirm, at the bottom right, from one component (Trevor, 2026-10-17: "Always be
 * cancel or confirm. Should always be at the bottom right of a modal. Should be unified
 * component"; "Done can be separate. It's just when storytellers need to make decision").
 *
 * Reported, outside ModalActions.svelte: a Button or <button> inside a Dialog or
 * BottomSheet whose text is a decision word (Cancel, Confirm, Save, Apply, OK, Yes, No,
 * Submit), written out or as a catalog message. Done and Close are not decisions.
 */
import { visibleText } from './button-text.js';

const DECISION = /^\s*(cancel|confirm|save|apply|ok|okay|yes|no|submit)\b/i;
const MODALS = new Set(['Dialog', 'BottomSheet']);

/** @param {any} node */
function inModal(node) {
	for (let n = node.parent; n; n = n.parent)
		if (n.type === 'SvelteElement' && n.kind === 'component' && MODALS.has(n.name?.name))
			return true;
	return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export const modalActions = {
	meta: {
		type: 'problem',
		docs: { description: 'Decision modals end in the shared Cancel / Confirm ModalActions.' },
		messages: {
			use: 'A decision in a modal ends in Cancel and Confirm at the bottom right: <ModalActions onCancel onConfirm> (#lib/ui/primitives/ModalActions.svelte).'
		},
		schema: []
	},
	create(context) {
		if (context.filename.endsWith('ModalActions.svelte')) return {};
		return {
			/** @param {any} node */
			SvelteElement(node) {
				const name = node.name?.name;
				const isButton =
					(node.kind === 'component' && name === 'Button') ||
					(node.kind === 'html' && name === 'button');
				if (isButton && inModal(node) && DECISION.test(visibleText(node)))
					context.report({ node: node.startTag, messageId: 'use' });
			}
		};
	}
};
