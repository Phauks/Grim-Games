<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { account } from './account.svelte.ts';
</script>

<!-- For the app header: opens the Account page. Same size whether signed in or not. The root
     layout checks the session (startAccount), since game screens hide the header. -->
<IconButton
	icon="account"
	label={account.user ? `Account: signed in as ${account.user.email}` : 'Account'}
	data-signed-in={account.status === 'signed-in'}
	onclick={() => goto(resolve('/account'))}
/>
