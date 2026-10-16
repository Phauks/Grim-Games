<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { account } from './account.svelte.ts';
</script>

<!-- For the app header: opens the Account page. Same size whether signed in or not. The root
     layout checks the session (startAccount), since game screens hide the header. -->
<IconButton
	icon="account"
	label={account.user
		? t('account.buttonSignedIn', { email: account.user.email })
		: t('account.button')}
	data-signed-in={account.status === 'signed-in'}
	onclick={() => goto(resolve('/account'))}
/>
