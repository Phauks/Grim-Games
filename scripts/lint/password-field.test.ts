import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** `grim/password-field` against the real config: only account password fields are passwords. */
const root = fileURLToPath(new URL('../../', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function problems(template: string, filePath = 'src/lib/features/room/RoomPanel.svelte') {
	const code = `<script lang="ts">
	import TextField from '#lib/ui/primitives/TextField.svelte';
	let text = $state('');
</script>

${template}
`;
	const [result] = await eslint.lintText(code, { filePath });
	return result.messages.filter((m) => m.ruleId === 'grim/password-field').length;
}

describe('grim/password-field', () => {
	it('reports a password field outside the account password screens', async () => {
		expect(await problems('<TextField label="Secret" type="password" bind:value={text} />')).toBe(
			1
		);
	}, 60_000);

	it('allows a secret field, and the sign-in password', async () => {
		expect(await problems('<TextField label="Secret" type="secret" bind:value={text} />')).toBe(0);
		expect(
			await problems(
				'<TextField label="Password" type="password" bind:value={text} />',
				'src/lib/features/account/SignInForm.svelte'
			)
		).toBe(0);
	}, 60_000);
});
