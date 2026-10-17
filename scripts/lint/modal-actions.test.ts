import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/modal-actions` against the real config: decision modals end in ModalActions. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(template: string) {
	const code = `<script lang="ts">
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	let open = $state(false);
	const go = () => {};
</script>

${template}
`;
	const [result] = await eslint.lintText(code, {
		filePath: 'src/lib/features/reference/NightOrderReference.svelte'
	});
	return result.messages.filter((m) => m.ruleId === 'grim/modal-actions').length;
}

describe('grim/modal-actions', () => {
	it('reports hand-built decision buttons in a modal', async () => {
		expect(
			await problems(
				'<Dialog bind:open title="x">y{#snippet actions()}<Button onclick={go}>Cancel</Button><Button onclick={go}>Save</Button>{/snippet}</Dialog>'
			)
		).toBe(2);
		expect(
			await problems(
				`<Dialog bind:open title="x"><Button onclick={go}>{t('common.confirm')}</Button></Dialog>`
			)
		).toBe(1);
	}, 60_000);

	it('allows ModalActions, Done and buttons outside modals', async () => {
		expect(
			await problems(
				'<Dialog bind:open title="x">y{#snippet actions()}<ModalActions onCancel={go} onConfirm={go} />{/snippet}</Dialog>'
			)
		).toBe(0);
		expect(
			await problems(
				'<Dialog bind:open title="x">y{#snippet actions()}<Button onclick={go}>Done</Button>{/snippet}</Dialog>'
			)
		).toBe(0);
		expect(await problems('<Button onclick={go}>Save as new</Button>')).toBe(0);
	}, 60_000);
});
