<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { DEFAULT_PREFERENCES } from '#lib/ui/preferences.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';

	/**
	 * The one Animations setting (Trevor, 2026-11-16), the same for players, Storytellers and
	 * spectators, in Settings > Theme. It is not in the menu (Trevor, 2026-11-16: "should not be
	 * in the left sidebar").
	 */
</script>

<SettingSelect
	label={t('settings.animations')}
	value={preferences.current.animations}
	defaultValue={DEFAULT_PREFERENCES.animations}
	options={[
		{ value: 'device', label: t('settings.animationsDevice') },
		{ value: 'on', label: t('settings.animationsOn') },
		{ value: 'off', label: t('settings.animationsOff') }
	]}
	onChange={(animations) => preferences.update({ animations })}
/>
