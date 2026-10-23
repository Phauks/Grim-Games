<script lang="ts">
	import { tileFaceOptions } from '#lib/features/setup/tile-face.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { ASSIST_LABELS, type AssistKey } from '#lib/ui/assistance.ts';
	import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
	import { canVibrate, playTimerSound, vibrateTimer } from '#lib/features/day/timer-sound.ts';
	import { canKeepAwake } from '#lib/features/day/timer-wake-lock.ts';
	import TimerPerPlayerRow from '#lib/features/day/TimerPerPlayerRow.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { TIMER_SOUNDS } from '#lib/ui/preferences.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { STORYTELLER_GROUPS } from './storyteller-groups.ts';
	import QrCentreSetting from '#lib/ui/share/QrCentreSetting.svelte';

	const assistance = $derived(preferences.current.assistance);
</script>

<!-- Every Storyteller-only setting, under plain headings so the list scans (Trevor, 2026-10-17). -->
{#snippet toggle(key: AssistKey)}
	<SettingToggle
		label={ASSIST_LABELS[key].label}
		description={ASSIST_LABELS[key].description}
		checked={assistance[key]}
		onChange={(checked) => preferences.update({ assistance: { ...assistance, [key]: checked } })}
	/>
{/snippet}

<h3>{t('settings.groupNight')}</h3>
{#each STORYTELLER_GROUPS.night as key (key)}{@render toggle(key)}{/each}

<h3>{t('settings.groupSetup')}</h3>
<!-- What face-down bag tiles show (Trevor, 2026-10-16: a dropdown, not a switch). -->
<SettingSelect
	label={t('settings.tileLabels')}
	value={preferences.current.tileFace}
	options={tileFaceOptions()}
	defaultValue="numbers"
	onChange={(tileFace) => preferences.update({ tileFace })}
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
<SettingToggle
	label={t('settings.ownWording')}
	description={t('settings.ownWordingHelp')}
	checked={preferences.current.ownWording}
	onChange={(ownWording) => preferences.update({ ownWording })}
/>

<h3>{t('settings.groupDay')}</h3>
{#each STORYTELLER_GROUPS.day as key (key)}{@render toggle(key)}{/each}
<!-- The day timer's own choices, the same values as on the timer (Trevor, 2026-10-17). -->
<SettingSelect
	label={t('day.timerSoundTitle')}
	value={preferences.current.timerSound}
	options={TIMER_SOUNDS.map((sound) => ({ value: sound, label: t(`day.timerSound.${sound}`) }))}
	defaultValue="bell"
	onChange={(timerSound) => {
		preferences.update({ timerSound });
		playTimerSound(timerSound);
	}}
/>
<SettingToggle
	label={t('day.timerVibrate')}
	description={canVibrate() ? undefined : t('day.timerVibrateUnavailable')}
	checked={canVibrate() && preferences.current.timerVibrate}
	disabled={!canVibrate()}
	onChange={(timerVibrate) => {
		preferences.update({ timerVibrate });
		if (timerVibrate) vibrateTimer();
	}}
/>
<SettingToggle
	label={t('day.timerKeepAwake')}
	description={canKeepAwake() ? undefined : t('day.timerKeepAwakeUnavailable')}
	checked={canKeepAwake() && preferences.current.timerKeepAwake}
	disabled={!canKeepAwake()}
	onChange={(on) => liveDayTimer.setKeepAwake(on)}
/>
<SettingSelect
	label={t('day.timer')}
	value={preferences.current.timerMode}
	options={[
		{ value: 'down', label: t('day.timerModeDown') },
		{ value: 'up', label: t('day.timerModeUp') }
	]}
	defaultValue="down"
	onChange={(timerMode) => preferences.update({ timerMode })}
/>
<TimerPerPlayerRow />

<h3>{t('settings.groupShare')}</h3>
<!-- Also on Share, beside the view-only link, where it is used. -->
<SettingToggle
	label={t('settings.hideWatchLink')}
	description={t('settings.hideWatchLinkHelp')}
	checked={preferences.current.hideWatchLink}
	onChange={(hideWatchLink) => preferences.update({ hideWatchLink })}
/>
<QrCentreSetting />

<style>
	h3 {
		margin: var(--space-5) 0 var(--space-1);
		font-family: var(--font-control);
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
	}
	h3:first-of-type {
		margin-top: 0;
	}
</style>
