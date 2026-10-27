<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { accountApi } from './account-api.ts';
	import { account } from './account.svelte.ts';
	import { normaliseUsername, USERNAME_MAX, USERNAME_MIN } from './account-protocol.ts';

	/** Picks or changes the username; Enter saves. The account's id never changes. */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	let name = $state('');
	let error = $state('');
	let busy = $state(false);
	const valid = $derived(normaliseUsername(name));

	// Starts from the current name each time it opens.
	$effect(() => {
		if (open) {
			name = account.user?.username ?? '';
			error = '';
		}
	});

	async function save(): Promise<void> {
		if (!valid || busy) return;
		if (valid === account.user?.username) {
			open = false;
			return;
		}
		busy = true;
		error = '';
		try {
			account.updated(await accountApi.setUsername(valid));
			open = false;
			toast(t('account.username.saved', { name: valid }));
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open title={t('account.username.title')}>
	<TextField
		plain
		label={t('account.username.label')}
		bind:value={name}
		maxlength={USERNAME_MAX}
		autocomplete="username"
		spellcheck={false}
		invalid={name.trim() !== '' && !valid}
		disabled={busy}
		oncommit={() => void save()}
	/>
	<p class="note">{t('account.username.rules', { min: USERNAME_MIN, max: USERNAME_MAX })}</p>
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
	}
	.note {
		color: var(--on-surface-muted);
	}
	.error {
		color: var(--evil-text);
		overflow-wrap: anywhere;
	}
</style>
