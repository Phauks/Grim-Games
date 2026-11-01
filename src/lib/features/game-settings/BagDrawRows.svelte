<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import type { GameSettings } from './game-settings.ts';

	/**
	 * The bag draw's switches, kept per game (game-settings.ts): one set of rows for Settings ›
	 * Storyteller, the bag's cog and Game settings, each saying what a change reaches.
	 */
	interface Props {
		values: GameSettings;
		onChange: (change: Partial<GameSettings>) => void;
	}

	let { values, onChange }: Props = $props();
	const face = $derived(preferences.current.tileFace);
</script>

<SettingToggle
	label={t('settings.tileOrderRandom')}
	description={t('settings.tileOrderRandomHelp')}
	checked={values.tileOrderRandom}
	disabled={face === 'random' || face === 'none'}
	onChange={(tileOrderRandom) => onChange({ tileOrderRandom })}
/>
<SettingToggle
	label={t('settings.requireName')}
	description={t('settings.requireNameHelp')}
	checked={values.requireName}
	onChange={(requireName) => onChange({ requireName })}
/>
<SettingToggle
	label={t('settings.holdToReveal')}
	description={t('settings.holdToRevealHelp')}
	checked={values.holdToReveal}
	onChange={(holdToReveal) => onChange({ holdToReveal })}
/>
<SettingToggle
	label={t('settings.slotMachine')}
	description={t('settings.slotMachineHelp')}
	checked={values.slotMachine}
	onChange={(slotMachine) => onChange({ slotMachine })}
/>
<SettingToggle
	label={t('settings.travellersChoose')}
	description={t('settings.travellersChooseHelp')}
	checked={values.travellersChoose}
	onChange={(travellersChoose) => onChange({ travellersChoose })}
/>
