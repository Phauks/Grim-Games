<script lang="ts">
	import { normaliseUsername, USERNAME_MAX } from '#lib/features/account/account-protocol.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ScanFieldDialog from './ScanFieldDialog.svelte';
	import { friends } from './friends.svelte.ts';
	import { readFriendLink } from './friends-protocol.ts';

	/**
	 * Asks someone by their exact username (plan F1); Enter sends. A refusal stays in the
	 * dialog; a request that went out just closes it, and shows under Sent or Friends.
	 * The camera in the field reads someone's friend code into it (Trevor, 2026-10-29 and 30).
	 */
	let { open = $bindable(false), initial = '' }: { open?: boolean; initial?: string } = $props();

	let name = $state('');
	let error = $state('');
	let busy = $state(false);
	const valid = $derived(normaliseUsername(name));

	$effect(() => {
		if (open) {
			name = initial;
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

<ScanFieldDialog
	bind:open
	bind:value={name}
	title={t('friends.addDialog.title')}
	label={t('friends.addDialog.username')}
	maxlength={USERNAME_MAX}
	valid={!!valid}
	{busy}
	{error}
	confirmLabel={t('friends.addDialog.send')}
	onConfirm={() => void send()}
	read={readFriendLink}
	notCode={t('friends.addDialog.notFriendCode')}
/>
