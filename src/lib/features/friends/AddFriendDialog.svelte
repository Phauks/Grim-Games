<script lang="ts">
	import { normaliseUsername, USERNAME_MAX } from '#lib/features/account/account-protocol.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { friends } from './friends.svelte.ts';

	/**
	 * Asks someone by their exact username (plan F1); Enter sends. A refusal stays in the
	 * dialog; a request that went out just closes it, and shows under Sent or Friends.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	let name = $state('');
	let error = $state('');
	let busy = $state(false);
	const valid = $derived(normaliseUsername(name));

	$effect(() => {
		if (open) {
			name = '';
			error = '';
		}
	});

	async function send(): Promise<void> {
		if (!valid || busy) return;
		busy = true;
		error = '';
		try {
			const answer = await friends.request(valid);
			if (answer.ok) open = false;
			else error = t(`friends.refused.${answer.reason}`);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open title={t('friends.addDialog.title')}>
	<TextField
		plain
		label={t('friends.addDialog.username')}
		bind:value={name}
		maxlength={USERNAME_MAX}
		autocomplete="off"
		spellcheck={false}
		invalid={name.trim() !== '' && !valid}
		disabled={busy}
		oncommit={() => void send()}
	/>
	<!-- Always there, so an error never moves the buttons. -->
	<p class="error" role="status">{error}</p>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={() => void send()}
			confirmLabel={t('friends.addDialog.send')}
			disabled={!valid || busy}
		/>
	{/snippet}
</Dialog>

<style>
	.error {
		margin: var(--space-1) 0 0;
		min-height: 1lh;
		color: var(--evil-text);
		overflow-wrap: anywhere;
	}
</style>
