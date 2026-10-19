<script lang="ts">
	import TokenAppearanceSettings from '#lib/features/characters/TokenAppearanceSettings.svelte';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { DEFAULT_PREFERENCES, ICON_SCALE } from '#lib/ui/preferences.ts';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import FontPreview from './FontPreview.svelte';
</script>

<!-- Tokens (Trevor, 2026-10-18: split from Board): one box each for the character token, the
     reminder token, and names and reminders in text. -->
<TokenAppearanceSettings
	value={preferences.current.tokenAppearance}
	theme={preferences.theme}
	onChange={(tokenAppearance) => preferences.update({ tokenAppearance })}
>
	{#snippet characterFont()}
		<FontPreview roles={['character']} testid="character-font" />
	{/snippet}
	{#snippet reminderFont()}
		<FontPreview roles={['reminder']} testid="reminder-font" />
	{/snippet}
	<!-- Character icons belong with the characters, not the interface icons (Trevor, 2026-10-19). -->
	{#snippet characterIconSize()}
		<SettingSlider
			label={t('settings.characterIconSize')}
			description={t('settings.characterIconSizeHelp')}
			value={preferences.current.characterIconScale}
			defaultValue={DEFAULT_PREFERENCES.characterIconScale}
			{...ICON_SCALE}
			format={(scale) => intl.number(scale, { style: 'percent' })}
			onChange={(characterIconScale) => preferences.update({ characterIconScale })}
		/>
	{/snippet}
</TokenAppearanceSettings>
