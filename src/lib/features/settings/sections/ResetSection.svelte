<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';

	let confirmReset = $state(false);

	function reset() {
		preferences.reset();
		confirmReset = false;
		toast(t('settings.resetDone'), t('settings.resetDoneText'));
	}
</script>

<SettingRow label={t('settings.resetAll')}>
	{#snippet control(labelId)}
		<Button
			variant="quiet"
			icon="undo"
			aria-describedby={labelId}
			onclick={() => (confirmReset = true)}
		>
			{t('settings.resetAllButton')}
		</Button>
	{/snippet}
</SettingRow>

<ConfirmDialog
	bind:open={confirmReset}
	title={t('settings.resetConfirmTitle')}
	danger
	onConfirm={reset}
>
	<p>{t('settings.resetConfirmText')}</p>
</ConfirmDialog>
