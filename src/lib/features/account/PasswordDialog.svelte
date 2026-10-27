<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { accountApi } from './account-api.ts';
	import { account } from './account.svelte.ts';
	import { checkPassword, PASSWORD_MAX, PASSWORD_MIN } from './account-protocol.ts';

	/**
	 * Sets or replaces the password; Enter saves. Being signed in is enough (an emailed code
	 * signs in too), and every other device is signed out.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	let password = $state('');
	let error = $state('');
	let busy = $state(false);
	const valid = $derived(checkPassword(password));

	$effect(() => {
		if (open) {
			password = '';
			error = '';
		}
	});

	async function save(): Promise<void> {
		if (!valid || busy) return;
		busy = true;
		error = '';
		try {
			account.updated(await accountApi.setPassword(valid));
			open = false;
			toast(t('account.password.saved'));
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open title={t('account.password.title')}>
	<TextField
		plain
		label={t('account.password.label')}
		bind:value={password}
		type="password"
		autocomplete="new-password"
		maxlength={PASSWORD_MAX * 2}
		invalid={password !== '' && !valid}
		disabled={busy}
		oncommit={() => void save()}
	/>
	<p class="note">{t('account.password.rules', { min: PASSWORD_MIN, max: PASSWORD_MAX })}</p>
	<!-- Always there, so an error never moves the buttons. -->
	<p class="error" role="status">{error}</p>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={() => void save()}
			disabled={!valid || busy}
		/>
	{/snippet}
</Dialog>

<style>
	.note,
	.error {
		margin: var(--space-1) 0 0;
		min-height: 1lh;
		font-family: var(--font-account);
	}
	.note {
		color: var(--on-surface-muted);
	}
	.error {
		color: var(--evil-text);
		overflow-wrap: anywhere;
	}
</style>
