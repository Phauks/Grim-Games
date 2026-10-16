<script lang="ts">
	import Button from '#lib/ui/primitives/Button.svelte';
	import { accountApi } from './account-api.ts';
	import { account } from './account.svelte.ts';
	import { CODE_LENGTH, normaliseCode, normaliseEmail } from './account-protocol.ts';

	let step = $state<'email' | 'code'>('email');
	let email = $state('');
	let code = $state('');
	let sentTo = $state('');
	let previewCode = $state<string | undefined>(undefined);
	let error = $state('');
	let busy = $state(false);

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
			error = 'Enter a valid email address.';
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
			error = `Enter the ${CODE_LENGTH}-digit code.`;
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
				<span>Email address</span>
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
				{#if unavailable}
					Signing in is not available yet on this site.
				{:else}
					We email you a {CODE_LENGTH}-digit code. No password.
				{/if}
			</p>
			<div class="buttons">
				<Button type="submit" variant="accent" disabled={unavailable || busy}>Send code</Button>
			</div>
		</form>
	{:else}
		<form onsubmit={verify}>
			<label class="field">
				<span>Code sent to {sentTo}</span>
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
				{#if previewCode}
					Preview build: no email is sent. Your code is <strong>{previewCode}</strong>.
				{:else}
					Check your email. The code works for 10 minutes.
				{/if}
			</p>
			<div class="buttons">
				<Button variant="quiet" onclick={changeEmail} disabled={busy}>Change email</Button>
				<Button variant="quiet" onclick={() => send()} disabled={busy}>Send a new code</Button>
				<Button type="submit" variant="accent" disabled={busy}>Sign in</Button>
			</div>
		</form>
	{/if}
	<!-- Always there, so an error never moves the buttons. -->
	<p class="error" role="status">{error}</p>
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
