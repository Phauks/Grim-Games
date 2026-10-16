<script lang="ts">
	import { onMount } from 'svelte';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { accountApi, EXPORT_PATH } from './account-api.ts';
	import { account } from './account.svelte.ts';
	import { readSignInHash, type DeviceSession } from './account-protocol.ts';
	import ProfileScripts from './ProfileScripts.svelte';
	import SignInForm from './SignInForm.svelte';
	import { startAccount } from './start.ts';

	let linkError = $state('');
	let sessions = $state.raw<DeviceSession[] | undefined>(undefined);
	let sessionsError = $state('');
	let confirmDelete = $state(false);
	let busy = $state(false);

	const date = (ms: number) => new Date(ms).toLocaleDateString();

	/** A sign-in link: the token is in the hash, which never reaches the server's logs. */
	function openSignInLink(): boolean {
		const link = readSignInHash(location.hash);
		if (!link) return false;
		history.replaceState(history.state, '', location.pathname);
		linkError = '';
		accountApi
			.verifyLink(link.email, link.token)
			.then((info) => {
				account.signedIn(info);
				toast(`Signed in as ${link.email}`);
			})
			.catch((e) => {
				linkError = `This sign-in link didn't work: ${e instanceof Error ? e.message : e}`;
				void startAccount();
			});
		return true;
	}

	onMount(() => {
		// The root layout already checks the session; a sign-in link replaces that check.
		openSignInLink();
		// The link can also be opened while this page is already showing.
		const onHash = () => void openSignInLink();
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	});

	async function loadSessions(): Promise<void> {
		try {
			sessions = await accountApi.sessions();
			sessionsError = '';
		} catch (e) {
			sessionsError = e instanceof Error ? e.message : String(e);
		}
	}

	$effect(() => {
		if (account.status === 'signed-in') void loadSessions();
		else sessions = undefined;
	});

	async function act(action: () => Promise<void>): Promise<void> {
		busy = true;
		try {
			await action();
		} catch (e) {
			toast('That did not work', e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}

	const signOut = () =>
		act(async () => {
			await account.signOut();
			toast('Signed out on this device');
		});

	const endSession = (id: string) =>
		act(async () => {
			await accountApi.endSession(id);
			await loadSessions();
		});

	const endOthers = () =>
		act(async () => {
			await accountApi.endOtherSessions();
			await loadSessions();
		});

	const deleteAccount = () =>
		act(async () => {
			await accountApi.deleteAccount();
			confirmDelete = false;
			account.forget();
			toast('Your account and all its data were deleted');
		});
</script>

<main>
	<h1>Account</h1>
	<ErrorBoundary area="account">
		{#if account.status === 'signed-in' && account.user}
			<section class="card" aria-labelledby="you">
				<h2 id="you">Signed in</h2>
				<dl>
					<dt>Email</dt>
					<dd data-testid="account-email">{account.user.email}</dd>
					<dt>Since</dt>
					<dd>{date(account.user.createdAt)}</dd>
				</dl>
				<div class="buttons">
					<Button variant="quiet" onclick={signOut} disabled={busy}>Sign out</Button>
				</div>
			</section>

			<section aria-labelledby="scripts">
				<h2 id="scripts">Your scripts</h2>
				<ProfileScripts />
			</section>

			<section aria-labelledby="devices">
				<h2 id="devices">Signed-in devices</h2>
				{#if sessionsError}
					<p class="muted">{sessionsError}</p>
				{:else if sessions}
					<ul class="devices">
						{#each sessions as session (session.id)}
							<li>
								<span>
									{session.device}{session.current ? ' (this device)' : ''}
									<small>Last used {date(session.lastSeenAt)}</small>
								</span>
								<Button
									variant="quiet"
									onclick={() => endSession(session.id)}
									disabled={busy || session.current}>Sign out</Button
								>
							</li>
						{/each}
					</ul>
					<div class="buttons">
						<Button variant="quiet" onclick={endOthers} disabled={busy || sessions.length < 2}
							>Sign out other devices</Button
						>
					</div>
				{:else}
					<p class="muted">Loading…</p>
				{/if}
			</section>

			<section aria-labelledby="data">
				<h2 id="data">Your data</h2>
				<div class="buttons start">
					<Button variant="quiet" onclick={() => location.assign(EXPORT_PATH)}
						>Download my data</Button
					>
					<Button variant="quiet" icon="remove" onclick={() => (confirmDelete = true)}
						>Delete account</Button
					>
				</div>
			</section>
		{:else}
			<section class="card" aria-labelledby="sign-in">
				<h2 id="sign-in">Sign in</h2>
				<p class="muted">
					Optional. Signing in saves the scripts you add to your profile, so you can use them on
					your other devices.
				</p>
				{#if account.status === 'checking'}
					<p class="muted">Checking…</p>
				{:else}
					{#if account.status === 'offline'}
						<p class="muted">You are offline. Connect to sign in.</p>
					{/if}
					<SignInForm notice={linkError} />
				{/if}
			</section>
		{/if}
	</ErrorBoundary>
</main>

<Dialog bind:open={confirmDelete} role="alertdialog" title="Delete your account?">
	<p>
		This deletes your account and every script saved to your profile, and signs out all your
		devices. Scripts and games saved on this device stay here. This can't be undone.
	</p>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (confirmDelete = false)}>Keep my account</Button>
		<Button variant="accent" onclick={deleteAccount} disabled={busy}>Delete account</Button>
	{/snippet}
</Dialog>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
		display: grid;
		gap: var(--space-5);
	}
	h1 {
		margin: 0;
		font-size: 2rem;
	}
	h2 {
		margin: 0 0 var(--space-2);
		font-size: 1.1rem;
	}
	.card {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
	}
	.card h2 {
		margin: 0;
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
	}
	dt,
	.muted,
	small {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.muted {
		margin: 0;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.buttons.start {
		justify-content: flex-start;
	}
	.devices {
		list-style: none;
		margin: 0 0 var(--space-2);
		padding: 0;
		display: grid;
		gap: var(--space-1);
	}
	.devices li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.devices small {
		display: block;
	}
</style>
