<script lang="ts">
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import { tileFaceOptions } from '#lib/features/setup/tile-face.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { gameSettings } from '#lib/features/game-settings/game-settings.svelte.ts';
	import BagDrawRows from '#lib/features/game-settings/BagDrawRows.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import type { SetupGamePort } from './game-port.ts';
	import ScriptCharactersRow from './ScriptCharactersRow.svelte';

	let { disabled = false, port }: { disabled?: boolean; port?: SetupGamePort } = $props();
	let open = $state(false);
</script>

<!--
	The bag draw settings, reachable while dealing with the bag (Trevor, 2026-10-17).
	The same stored values as Settings > Storyteller, so a change in one shows in the other.
	Setup has no app sidebar, so All settings is here too: one cog, not two (Trevor, 2026-10-24).
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
		<BagDrawRows
			values={gameSettings.current}
			onChange={(change) => gameSettings.set(gameSettings.gameId, change)}
		/>
		{#if port}<ScriptCharactersRow {port} />{/if}
		<div class="all">
			<Button
				onclick={() => {
					open = false;
					settingsDialog.show();
				}}>{t('settings.allSettings')}</Button
			>
		</div>
	</div>
</Dialog>

<style>
	.settings {
		display: grid;
		gap: var(--space-2);
	}
	.all {
		display: flex;
		justify-content: flex-end;
	}
</style>
