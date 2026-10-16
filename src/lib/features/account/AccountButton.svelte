<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { account } from './account.svelte.ts';
	import { startAccount } from './start.ts';

	$effect(() => {
		void startAccount();
	});
</script>

<!-- For the app header: opens the Account page. Same size whether signed in or not. -->
<IconButton
	icon="account"
	label={account.user ? `Account: signed in as ${account.user.email}` : 'Account'}
	data-signed-in={account.status === 'signed-in'}
	onclick={() => goto(resolve('/account'))}
/>
