<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { callTownPush } from './call-town-push.svelte.ts';

	const blocked = $derived(callTownPush.blocked);
	let busy = $state(false);

	async function change(on: boolean) {
		busy = true;
		if (!on) await callTownPush.turnOff();
		else if (!(await callTownPush.turnOn()) && !callTownPush.blocked)
			toast(t('settings.callTownPushFailed'));
		busy = false;
	}
</script>

<!-- Back to town on a locked phone or with the app closed (plan U12). Shown off and disabled,
     with why, where the browser can't, so it looks the same everywhere (as Vibrate). -->
<SettingToggle
	label={t('settings.callTownPush')}
	description={blocked ? t(`settings.callTownPush.${blocked}`) : undefined}
	checked={callTownPush.on}
	disabled={!!blocked || busy}
	onChange={change}
/>
