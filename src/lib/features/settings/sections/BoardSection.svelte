<script lang="ts">
	import TokenAppearanceSettings from '#lib/features/characters/TokenAppearanceSettings.svelte';
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import { ASSIST_LABELS } from '#lib/ui/assistance.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { DEFAULT_PREFERENCES, ICON_SCALE } from '#lib/ui/preferences.ts';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import ReminderModeSetting from '#lib/features/grimoire/ReminderModeSetting.svelte';
	import BoardLooksRows from './BoardLooksRows.svelte';
	import DefaultBackgroundRow from './DefaultBackgroundRow.svelte';
	import { STORYTELLER_GROUPS } from './storyteller-groups.ts';

	/**
	 * Everything about how the grimoire board and its tokens look (Trevor, 2026-10-17), also
	 * opened on its own from the board's menu with `settingsDialog.show('board')`.
	 */
	const assistance = $derived(preferences.current.assistance);
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

<h3>{t('settings.groupBoard')}</h3>
<DefaultBackgroundRow />
{#each STORYTELLER_GROUPS.board as key (key)}
	<SettingToggle
		label={ASSIST_LABELS[key].label}
		description={ASSIST_LABELS[key].description}
		checked={assistance[key]}
		onChange={(checked) => preferences.update({ assistance: { ...assistance, [key]: checked } })}
	/>
{/each}
<BoardLooksRows />
<!-- The board thread's own control, with its Confirm (Trevor, 2026-10-17). -->
<ReminderModeSetting />

<style>
	h3 {
		margin: var(--space-5) 0 var(--space-1);
		font-family: var(--font-control);
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
	}
</style>
