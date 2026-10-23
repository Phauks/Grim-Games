<script lang="ts">
	import { tileFaceOptions } from '#lib/features/setup/tile-face.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';

	let { disabled = false }: { disabled?: boolean } = $props();
	let open = $state(false);
</script>

<!--
	The bag draw settings, reachable while dealing with the bag (Trevor, 2026-10-17).
	The same stored values as Settings > Storyteller, so a change in one shows in the other.
-->
<IconButton
	icon="settings"
	label={t('settings.groupSetup')}
	{disabled}
	onclick={() => (open = true)}
/>
<Dialog bind:open title={t('settings.groupSetup')}>
	<div class="settings" data-testid="bag-settings">
		<SettingSelect
			label={t('settings.tileLabels')}
			value={preferences.current.tileFace}
			options={tileFaceOptions()}
			defaultValue="numbers"
			onChange={(tileFace) => preferences.update({ tileFace })}
		/>
		<SettingToggle
			label={t('settings.tileOrderRandom')}
			description={t('settings.tileOrderRandomHelp')}
			checked={preferences.current.tileOrderRandom}
			disabled={preferences.current.tileFace === 'random' ||
				preferences.current.tileFace === 'none'}
			onChange={(tileOrderRandom) => preferences.update({ tileOrderRandom })}
		/>
		<SettingToggle
			label={t('settings.requireName')}
			description={t('settings.requireNameHelp')}
			checked={preferences.current.requireName}
			onChange={(requireName) => preferences.update({ requireName })}
		/>
		<SettingToggle
			label={t('settings.holdToReveal')}
			description={t('settings.holdToRevealHelp')}
			checked={preferences.current.holdToReveal}
			onChange={(holdToReveal) => preferences.update({ holdToReveal })}
		/>
		<SettingToggle
			label={t('settings.slotMachine')}
			description={t('settings.slotMachineHelp')}
			checked={preferences.current.slotMachine}
			onChange={(slotMachine) => preferences.update({ slotMachine })}
		/>
	</div>
</Dialog>

<style>
	.settings {
		display: grid;
		gap: var(--space-2);
	}
</style>
