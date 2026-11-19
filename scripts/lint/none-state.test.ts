import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/none-state` against the real config: every empty state is the shared NoneState. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(template: string) {
	const code = `<script lang="ts">
	import NoneState from '#lib/ui/primitives/NoneState.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	const items: string[] = [];
	const name = '';
</script>

${template}
`;
	const [result] = await eslint.lintText(code, {
		filePath: 'src/lib/features/room/PlayersPanel.svelte'
	});
	return result.messages.filter((m) => m.ruleId === 'grim/none-state').length;
}

describe('grim/none-state', () => {
	it('reports a None drawn by hand', async () => {
		expect(await problems(`<p class="none">{t('common.none')}</p>`)).toBe(1);
		expect(await problems('<ul><li class="muted">None</li></ul>')).toBe(1);
		expect(await problems('<span>{#each items as i (i)}{i}{:else}None{/each}</span>')).toBe(1);
	}, 60_000);

	it('allows NoneState, a choice, an answer and a worked-out value', async () => {
		expect(await problems('<NoneState />')).toBe(0);
		expect(await problems('<button type="button">None</button>')).toBe(0);
		expect(await problems('<select><option>None</option></select>')).toBe(0);
		expect(await problems('<strong>None</strong>')).toBe(0);
		expect(await problems(`<span>{name || t('common.none')}</span>`)).toBe(0);
	}, 60_000);
});
