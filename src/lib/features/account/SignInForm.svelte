<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { accountApi } from './account-api.ts';
	import { account } from './account.svelte.ts';
	import { withPrivacyConsent } from './privacy-consent.svelte.ts';
	import {
		checkPassword,
		cleanEmail,
		CODE_LENGTH,
		normaliseCode,
		PASSWORD_MAX,
		PASSWORD_MIN
	} from './account-protocol.ts';

	/**
	 * Signing in with a password, or with a code emailed to the address (Trevor, 2026-10-18).
	 * "Create account" emails a code too, and the password typed here is set once the code
	 * proves the address; the same way replaces a forgotten password.
	 */
	interface Props {
		/** A message from outside the form, such as a sign-in link that didn't work. */
		notice?: string;
	}

	let { notice = '' }: Props = $props();

	let step = $state<'start' | 'code'>('start');
	/** Whether the code also sets the typed password (Create account). */
	let creating = $state(false);
	let email = $state('');
	let password = $state('');
	/** Off: the session ends when the browser closes, or after a while unused. */
	let remember = $state(true);
	let code = $state('');
	let sentTo = $state('');
	let previewCode = $state<string | undefined>(undefined);
	let error = $state('');
	let busy = $state(false);
	let startForm = $state<HTMLFormElement>();
	let codeForm = $state<HTMLFormElement>();

	/** Enter submits the form, as it did before (the browser checks `required` first). */
	function submitOnEnter(form: HTMLFormElement | undefined): false {
		form?.requestSubmit();
		return false;
	}

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

	function typedEmail(): string | undefined {
		const address = cleanEmail(email);
		if (!address) error = t('account.signIn.badEmail');
		return address;
	}

	function signInWithPassword(event?: SubmitEvent): void {
		event?.preventDefault();
		const address = typedEmail();
		if (!address) return;
		void run(async () =>
			account.signedIn(
				await withPrivacyConsent((accepted) =>
					accountApi.signInWithPassword(address, password, remember, accepted)
				)
			)
		);
	}

	/** Emails a code; with `create`, the code also sets the typed password. */
	function send(create: boolean): void {
		const address = typedEmail();
		if (!address) return;
		if (create && !checkPassword(password)) {
			error = t('account.signIn.badPassword', { min: PASSWORD_MIN, max: PASSWORD_MAX });
			return;
		}
		void run(async () => {
			const sent = await accountApi.start(address);
			sentTo = address;
			creating = create;
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
		void run(async () =>
			account.signedIn(
				await withPrivacyConsent((accepted) =>
					accountApi.verifyCode(sentTo, typed, remember, creating ? password : undefined, accepted)
				)
			)
		);
	}

	function changeEmail(): void {
		step = 'start';
		error = '';
		previewCode = undefined;
	}
</script>

<div class="sign-in">
	{#if step === 'start'}
		<form class="start" bind:this={startForm} onsubmit={signInWithPassword}>
			<TextField
				plain
				label={t('account.signIn.email')}
				bind:value={email}
				type="email"
				inputmode="email"
				autocomplete="email"
				enterkeyhint="next"
				required
				disabled={unavailable || busy}
				oncommit={() => submitOnEnter(startForm)}
			/>
			<TextField
				plain
				label={t('account.signIn.password')}
				bind:value={password}
				type="password"
				autocomplete="current-password"
				enterkeyhint="go"
				maxlength={PASSWORD_MAX * 2}
				disabled={unavailable || busy}
				oncommit={() => submitOnEnter(startForm)}
			/>
			<div class="remember">
				<Toggle
					label={t('account.signIn.remember')}
					checked={remember}
					onChange={(on) => (remember = on)}
					disabled={unavailable || busy}
				/>
			</div>
			<p class="note">
				{unavailable
					? t('account.signIn.unavailable')
					: t('account.signIn.howItWorks', { length: CODE_LENGTH })}
			</p>
			<div class="buttons">
				<Button variant="quiet" onclick={() => send(true)} disabled={unavailable || busy}
					>{t('account.signIn.create')}</Button
				>
				<Button variant="quiet" onclick={() => send(false)} disabled={unavailable || busy}
					>{t('account.signIn.emailCode')}</Button
				>
				<Button type="submit" variant="accent" disabled={unavailable || busy}
					>{t('account.signIn.submit')}</Button
				>
			</div>
		</form>
	{:else}
		<form class="code" bind:this={codeForm} onsubmit={verify}>
			<TextField
				plain
				label={t('account.signIn.codeSentTo', { email: sentTo })}
				bind:value={code}
				inputmode="numeric"
				autocomplete="one-time-code"
				maxlength={CODE_LENGTH + 2}
				required
				disabled={busy}
				oncommit={() => submitOnEnter(codeForm)}
			/>
			<p class="note" data-testid="preview-code">
				{#if previewLine}
					{previewLine.before}<strong>{previewCode}</strong>{previewLine.after}
				{:else if creating}
					{t('account.signIn.checkEmailCreate')}
				{:else}
					{t('account.signIn.checkEmail')}
				{/if}
			</p>
			<div class="buttons">
				<Button variant="quiet" onclick={changeEmail} disabled={busy}
					>{t('account.signIn.changeEmail')}</Button
				>
				<Button variant="quiet" onclick={() => send(creating)} disabled={busy}
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
	/* The address can be long and unbroken. */
	form :global(.text-field > span) {
		overflow-wrap: anywhere;
	}
	/* Full width on a phone; on a computer, sized to what goes in them. */
	.start :global(.clearable),
	.remember {
		max-width: 28rem;
	}
	.code :global(.clearable) {
		max-width: 12rem;
	}
	.code :global(input) {
		letter-spacing: 0.3em;
		font-variant-numeric: tabular-nums;
	}
	/* Two lines reserved, so the two steps and their notes keep the same height. */
	.note {
		min-height: 2lh;
		margin: 0;
		color: var(--on-surface-muted);
		font-family: var(--font-account);
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
		font-family: var(--font-account);
		overflow-wrap: anywhere;
	}
</style>
