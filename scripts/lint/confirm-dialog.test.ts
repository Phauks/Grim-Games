import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/confirm-dialog` against the real config: confirmations go through ConfirmDialog. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(code: string, filePath: string) {
	const [result] = await eslint.lintText(code, { filePath });
	return result.messages.filter((m) => m.ruleId === 'grim/confirm-dialog').length;
}

describe('grim/confirm-dialog', () => {
	it('reports an alertdialog outside ConfirmDialog', async () => {
		const code = `<script lang="ts">
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	let open = $state(false);
</script>

<Dialog bind:open title="Delete?" role="alertdialog">x</Dialog>
`;
		expect(await problems(code, 'src/lib/features/grimoire/SavedGamesList.svelte')).toBe(1);
		expect(await problems(code, 'src/lib/ui/primitives/ConfirmDialog.svelte')).toBe(0);
	}, 60_000);
});
