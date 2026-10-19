<script lang="ts">
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { privacyConsent } from './privacy-consent.svelte.ts';

	let accepted = $state(false);

	// A new question starts unticked: accepting is always the user's own tap.
	$effect(() => {
		void privacyConsent.question;
		accepted = false;
	});

	/**
	 * Open while there is a question. Closed any other way than Confirm (Cancel, Escape, ✕)
	 * counts as declining; Confirm answers first, so the later "no" finds nothing to answer.
	 */
	function isOpen(): boolean {
		return privacyConsent.question !== undefined;
	}
	function setOpen(value: boolean): void {
		if (!value) queueMicrotask(() => privacyConsent.answer(false));
	}
</script>

<!-- Before an account is made, or when the policy changed since it was accepted. -->
<ConfirmDialog
	bind:open={isOpen, setOpen}
	title={t('account.privacy.title')}
	disabled={!accepted}
	onConfirm={() => privacyConsent.answer(true)}
>
	<p>
		{privacyConsent.question?.creating
			? t('account.privacy.creating')
			: t('account.privacy.signIn')}
	</p>
	<p>
		<a href={resolve('/privacy')} target="_blank" rel="noopener">{t('account.privacy.read')}</a>
	</p>
	<Toggle
		label={t('account.privacy.accept')}
		checked={accepted}
		onChange={(on) => (accepted = on)}
	/>
</ConfirmDialog>
