<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import { playerSettings, SHEET_DENSITIES } from './player-settings.svelte.ts';
	import PrintSettingsFields from './PrintSettingsFields.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import SettingFrame from '#lib/ui/settings/SettingFrame.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';

	/** The frame choice that leaves it to the Storyteller's board. */
	const STORYTELLER = 'storyteller';
</script>

<!-- The frame round this player's seat token, sent with their initials (L4). -->
<SettingFrame
	label={t('player.frame')}
	value={playerSettings.current.frame ?? STORYTELLER}
	defaultValue={STORYTELLER}
	lead={{ value: STORYTELLER, label: t('player.frameStoryteller') }}
	onChange={(frame) => playerSettings.update({ frame: frame === STORYTELLER ? undefined : frame })}
	testid="player-frame-setting"
/>

<!-- Also in the Grim tab's guess sheet. -->
<SettingToggle
	label={t('player.guessesOnTokens')}
	description={t('player.guessesOnTokensDetail')}
	checked={playerSettings.current.guessesOnTokens}
	onChange={(guessesOnTokens) => playerSettings.update({ guessesOnTokens })}
/>

<SettingSelect
	label={t('player.density')}
	description={t('player.densityDetail')}
	value={playerSettings.current.density}
	options={SHEET_DENSITIES.map((value) => ({ value, label: t(`player.density.${value}`) }))}
	defaultValue="normal"
	onChange={(density) => playerSettings.update({ density })}
/>

<!-- Also at the top of every script sheet (Trevor, 2026-10-23). -->
<SettingToggle
	label={t('player.lightSheet')}
	checked={playerSettings.current.lightSheet}
	onChange={(lightSheet) => playerSettings.update({ lightSheet })}
/>

<!-- Also in Print's own screen (Trevor: every setting in Settings and where it is used). -->
<Collapsible title={t('player.printSettings')} level={3} storageKey="settings-player-print">
	<PrintSettingsFields />
</Collapsible>
