<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { invitePush } from './invite-push.svelte.ts';

	let busy = $state(false);

	onMount(() => void invitePush.refresh());

	async function change(on: boolean) {
		busy = true;
		if (!on) await invitePush.turnOff();
		else if (!(await invitePush.turnOn()) && !invitePush.blocked)
			toast(t('friends.invitePush.failed'));
		busy = false;
	}
</script>

<!-- Game invites pushed to this device with the app closed (plan F8): off until turned on, and
     off and disabled where the browser can't (iOS outside the Home Screen app), with no hint, so
     the row is the same everywhere. -->
<SettingToggle
	label={t('friends.invitePush')}
	checked={invitePush.on}
	disabled={!!invitePush.blocked || busy}
	onChange={change}
/>
