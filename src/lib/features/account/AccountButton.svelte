<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { account } from './account.svelte.ts';

	let open = $state(false);
	let anchor = $state<HTMLButtonElement>();
	let busy = $state(false);

	const user = $derived(account.status === 'signed-in' ? account.user : undefined);

	function tap(): void {
		if (user) open = !open;
		else void goto(resolve('/account'));
	}

	function settings(): void {
		open = false;
		void goto(resolve('/account'));
	}

	async function signOut(): Promise<void> {
		busy = true;
		try {
			await account.signOut();
			open = false;
			toast(t('account.signedOut'));
		} catch (e) {
			toast(t('account.failed'), e instanceof Error ? e.message : String(e));
		} finally {
			busy = false;
		}
	}
</script>

<!-- For the app header. Signed in: a card with who you are, Account settings and Sign out;
     signed out: opens the Account page to sign in. Same size either way. The root layout
     checks the session (startAccount), since game screens hide the header. -->
<IconButton
	bind:ref={anchor}
	icon="account"
	label={user
		? t('account.buttonSignedIn', { name: user.username ?? user.email })
		: t('account.button')}
	data-signed-in={account.status === 'signed-in'}
	aria-expanded={user ? open : undefined}
	onclick={tap}
/>

<Popover bind:open {anchor} title={t('account.title')}>
	{#if user}
		<div class="who" data-testid="account-card">
			<span class="avatar"><Icon name="account" /></span>
			<span class="names">
				<strong>{user.username ?? user.email}</strong>
				{#if user.username}<small>{user.email}</small>{/if}
			</span>
		</div>
		<div class="buttons">
			<Button variant="accent" onclick={settings}>{t('account.settings')}</Button>
			<Button variant="quiet" onclick={() => void signOut()} disabled={busy}
				>{t('account.signOut')}</Button
			>
		</div>
	{/if}
</Popover>

<style>
	.who {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: var(--space-1) 0 var(--space-3);
	}
	.avatar {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--tap-target);
		height: var(--tap-target);
		border-radius: var(--radius-full);
		background: var(--surface-selected);
		--icon-size: 1.5rem;
	}
	.names {
		display: grid;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	small {
		color: var(--on-surface-muted);
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
