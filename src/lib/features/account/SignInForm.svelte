<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { accountApi } from './account-api.ts';
	import { account } from './account.svelte.ts';
	import { CODE_LENGTH, normaliseCode, normaliseEmail } from './account-protocol.ts';

	interface Props {
		/** A message from outside the form, such as a sign-in link that didn't work. */
		notice?: string;
	}

	let { notice = '' }: Props = $props();

	let step = $state<'email' | 'code'>('email');
	let email = $state('');
	let code = $state('');
	let sentTo = $state('');
	let previewCode = $state<string | undefined>(undefined);
	let error = $state('');
	let busy = $state(false);

	/** The preview line, split around the code so the code can be bold. */
	const previewLine = $derived.by(() => {
		if (!previewCode) return undefined;
		const [before, ...after] = t('account.signIn.previewCode', { code: previewCode }).split(
			previewCode
		);
		return { before, after: after.join(previewCode) };
	});

	const unavailable = $derived(account.delivery === 'unavailable');

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

	function send(event?: SubmitEvent): void {
		event?.preventDefault();
		const address = normaliseEmail(email);
		if (!address) {
			error = t('account.signIn.badEmail');
			return;
		}
		void run(async () => {
			const sent = await accountApi.start(address);
			sentTo = address;
			previewCode = sent.preview?.code;
			code = '';
			step = 'code';
		});
	}

	function verify(event?: SubmitEvent): void {
		event?.preventDefault();
		const typed = normaliseCode(code);
		if (!typed) {
			error = t('account.signIn.badCode', { length: CODE_LENGTH });
			return;
		}
		void run(async () => account.signedIn(await accountApi.verifyCode(sentTo, typed)));
	}

	function changeEmail(): void {
		step = 'email';
		error = '';
		previewCode = undefined;
	}
</script>

<div class="sign-in">
	{#if step === 'email'}
		<form onsubmit={send}>
			<label class="field">
				<span>{t('account.signIn.email')}</span>
				<input
					type="email"
					inputmode="email"
					autocomplete="email"
					enterkeyhint="send"
					required
					disabled={unavailable || busy}
					bind:value={email}
				/>
			</label>
			<p class="note">
				{unavailable
					? t('account.signIn.unavailable')
					: t('account.signIn.howItWorks', { length: CODE_LENGTH })}
			</p>
			<div class="buttons">
				<Button type="submit" variant="accent" disabled={unavailable || busy}
					>{t('account.signIn.sendCode')}</Button
				>
			</div>
		</form>
	{:else}
		<form onsubmit={verify}>
			<label class="field">
				<span>{t('account.signIn.codeSentTo', { email: sentTo })}</span>
				<input
					type="text"
					inputmode="numeric"
					autocomplete="one-time-code"
					enterkeyhint="done"
					maxlength={CODE_LENGTH + 2}
					required
					disabled={busy}
					bind:value={code}
				/>
			</label>
			<p class="note" data-testid="preview-code">
				{#if previewLine}
					{previewLine.before}<strong>{previewCode}</strong>{previewLine.after}
				{:else}
					{t('account.signIn.checkEmail')}
				{/if}
			</p>
			<div class="buttons">
				<Button variant="quiet" onclick={changeEmail} disabled={busy}
					>{t('account.signIn.changeEmail')}</Button
				>
				<Button variant="quiet" onclick={() => send()} disabled={busy}
					>{t('account.signIn.resend')}</Button
				>
				<Button type="submit" variant="accent" disabled={busy}>{t('account.signIn.submit')}</Button>
			</div>
		</form>
	{/if}
	<!-- Always there, so an error never moves the buttons. -->
	<p class="error" role="status">{error || notice}</p>
</div>

<style>
	.sign-in {
		display: grid;
		gap: var(--space-2);
	}
	form {
		display: grid;
		gap: var(--space-2);
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	.field span {
		overflow-wrap: anywhere;
	}
	.field input {
		width: 100%;
		box-sizing: border-box;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: max(1rem, 16px);
	}
	/* Full width on a phone; on a computer, sized to what goes in them. */
	.field input[type='email'] {
		max-width: 28rem;
	}
	.field input[inputmode='numeric'] {
		max-width: 12rem;
		letter-spacing: 0.3em;
		font-variant-numeric: tabular-nums;
	}
	.field input:disabled {
		opacity: 0.6;
	}
	/* Two lines reserved, so the two steps and their notes keep the same height. */
	.note {
		min-height: 2lh;
		margin: 0;
		color: var(--on-surface-muted);
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.error {
		min-height: 2lh;
		margin: 0;
		color: var(--evil);
		overflow-wrap: anywhere;
	}
</style>
