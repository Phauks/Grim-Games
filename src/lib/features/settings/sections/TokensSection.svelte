<script lang="ts">
	import TokenAppearanceSettings from '#lib/features/characters/TokenAppearanceSettings.svelte';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { DEFAULT_PREFERENCES, ICON_SCALE } from '#lib/ui/preferences.ts';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
</script>

<TokenAppearanceSettings
	value={preferences.current.tokenAppearance}
	theme={preferences.theme}
	onChange={(tokenAppearance) => preferences.update({ tokenAppearance })}
/>
<!-- Beside token and reminder size (Trevor, 2026-10-16). -->
<SettingSlider
	label={t('settings.characterIconSize')}
	description={t('settings.characterIconSizeHelp')}
	value={preferences.current.characterIconScale}
	defaultValue={DEFAULT_PREFERENCES.characterIconScale}
	{...ICON_SCALE}
	format={(scale) => intl.number(scale, { style: 'percent' })}
	onChange={(characterIconScale) => preferences.update({ characterIconScale })}
/>
