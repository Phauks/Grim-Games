<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { accountApi } from './account-api.ts';
	import { account } from './account.svelte.ts';
	import { CODE_LENGTH, normaliseCode, normaliseEmail } from './account-protocol.ts';

	/**
	 * Moves the account to a new email address: a code goes to the new address, and the
	 * change happens once it is typed here. Both fields are always shown (the code one
	 * disabled until a code is sent), so nothing moves between the steps.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	let email = $state('');
	let code = $state('');
	let sentTo = $state('');
	let previewCode = $state<string | undefined>(undefined);
	let error = $state('');
	let busy = $state(false);

	$effect(() => {
		if (open) {
			email = '';
			code = '';
			sentTo = '';
			previewCode = undefined;
			error = '';
		}
	});

	async function run(action: () => Promise<void>): Promise<void> {
		busy = true;
		error = '';
		try {
			await action();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	function send(): void {
		const address = normaliseEmail(email);
		if (!address) {
			error = t('account.signIn.badEmail');
			return;
		}
		void run(async () => {
			const sent = await accountApi.startEmailChange(address);
			sentTo = address;
			previewCode = sent.preview?.code;
			code = '';
		});
	}

	function confirm(): void {
		const typed = normaliseCode(code);
		if (!sentTo || !typed) {
			error = t('account.signIn.badCode', { length: CODE_LENGTH });
			return;
		}
		void run(async () => {
			account.updated(await accountApi.verifyEmailChange(sentTo, typed));
			open = false;
			toast(t('account.changeEmail.done', { email: sentTo }));
		});
	}
</script>

<Dialog bind:open title={t('account.changeEmail.title')}>
	<div class="fields">
		<div class="row">
			<TextField
				label={t('account.changeEmail.newEmail')}
				bind:value={email}
				type="email"
				inputmode="email"
				autocomplete="email"
				enterkeyhint="send"
				disabled={busy}
				oncommit={() => {
					send();
					return false;
				}}
			/>
			<Button variant="quiet" onclick={send} disabled={busy}
				>{sentTo ? t('account.signIn.resend') : t('account.signIn.sendCode')}</Button
			>
		</div>
		<TextField
			label={sentTo
				? t('account.signIn.codeSentTo', { email: sentTo })
				: t('account.changeEmail.code')}
			bind:value={code}
			inputmode="numeric"
			autocomplete="one-time-code"
			maxlength={CODE_LENGTH + 2}
			disabled={busy || !sentTo}
			oncommit={confirm}
		/>
		<p class="note" data-testid="change-email-preview">
			{#if previewCode}
				{t('account.signIn.previewCode', { code: previewCode })}
			{:else if sentTo}
				{t('account.signIn.checkEmail')}
			{:else}
				{t('account.changeEmail.howItWorks')}
			{/if}
		</p>
		<!-- Always there, so an error never moves the buttons. -->
		<p class="error" role="status">{error}</p>
	</div>
	{#snippet actions()}
		<ModalActions onCancel={() => (open = false)} onConfirm={confirm} disabled={busy || !sentTo} />
	{/snippet}
</Dialog>

<style>
	.fields {
		display: grid;
		gap: var(--space-2);
	}
	/* The field at full width, its Send button under it on the right. */
	.row {
		display: grid;
		justify-items: end;
		gap: var(--space-2);
	}
	.row > :global(:first-child) {
		justify-self: stretch;
	}
	/* The address can be long and unbroken. */
	.fields :global(.text-field > span) {
		overflow-wrap: anywhere;
	}
	/* Two lines reserved, so the note and the error keep the dialog's height. */
	.note,
	.error {
		min-height: 2lh;
		margin: 0;
	}
	.note {
		color: var(--on-surface-muted);
	}
	.error {
		color: var(--evil);
		overflow-wrap: anywhere;
	}
</style>
