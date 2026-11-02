<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { account } from './account.svelte.ts';
	import SignInForm from './SignInForm.svelte';

	/**
	 * The sign-in form as a signed-out page shows it: Account settings, and Friends opened from
	 * someone's friend code (plan F12). Waits while the session is checked, and says when the
	 * app is offline. The page mounts `PrivacyConsent` once, beside it.
	 */
	let { notice = '' }: { notice?: string } = $props();
</script>

<div class="panel">
	{#if account.status === 'checking'}
		<p class="muted">{t('account.signIn.checking')}</p>
	{:else}
		{#if account.status === 'offline'}
			<p class="muted">{t('account.signIn.offline')}</p>
		{/if}
		<SignInForm {notice} />
	{/if}
</div>

<style>
	/* The card's width, whatever the card does with its other lines. */
	.panel {
		display: grid;
		gap: var(--space-2);
		justify-self: stretch;
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
