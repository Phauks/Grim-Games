<script lang="ts">
	import { tileFaceOptions } from '#lib/features/setup/tile-face.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { ASSIST_LABELS, type AssistKey } from '#lib/ui/assistance.ts';
	import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
	import { canKeepAwake } from '#lib/features/day/timer-wake-lock.ts';
	import TimerPerPlayerRow from '#lib/features/day/TimerPerPlayerRow.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { STORYTELLER_GROUPS } from './storyteller-groups.ts';
	import QrCentreSetting from '#lib/ui/share/QrCentreSetting.svelte';
	import QrPicture from '#lib/ui/share/QrPicture.svelte';
	import { qrPicture } from '#lib/ui/share/qr-picture.svelte.ts';
	import QrCode from '#lib/ui/primitives/QrCode.svelte';
	import SettingGroup from '#lib/ui/settings/SettingGroup.svelte';
	import SettingHeading from '#lib/ui/settings/SettingHeading.svelte';
	import ScriptQrCenter from '#lib/features/scripts/ScriptQrCenter.svelte';

	/** A room's join link, as the share screen's QR carries, for the preview only. */
	const SAMPLE_LINK = 'https://grimbinder.com/join/123456';
	const centre = $derived(preferences.current.qrCentre);
	const picture = $derived(centre === 'picture' && !!qrPicture.current);

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

<SettingHeading title={t('settings.groupNight')} first />
{#each STORYTELLER_GROUPS.night as key (key)}{@render toggle(key)}{/each}

<SettingHeading title={t('settings.groupSetup')} />
<!-- What face-down bag tiles show (Trevor, 2026-10-16: a dropdown, not a switch). -->
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
	disabled={preferences.current.tileFace === 'random' || preferences.current.tileFace === 'none'}
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
<SettingToggle
	label={t('settings.ownWording')}
	description={t('settings.ownWordingHelp')}
	checked={preferences.current.ownWording}
	onChange={(ownWording) => preferences.update({ ownWording })}
/>

<SettingHeading title={t('settings.groupDay')} />
{#each STORYTELLER_GROUPS.day as key (key)}{@render toggle(key)}{/each}
<!-- The day timer's own choices, the same values as on the timer (Trevor, 2026-10-17); its
     sound and vibration are in Settings > Sound (plan U1). -->
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

<SettingHeading title={t('settings.groupShare')} />
<!-- Also on Share, beside the view-only link, where it is used. -->
<SettingToggle
	label={t('settings.hideWatchLink')}
	description={t('settings.hideWatchLinkHelp')}
	checked={preferences.current.hideWatchLink}
	onChange={(hideWatchLink) => preferences.update({ hideWatchLink })}
/>
<!-- Every QR code setting beside a live QR (CLAUDE.md: a setting beside a preview changes it). -->
<SettingGroup title={t('share.qrPreview')} testid="qr-preview">
	{#snippet preview()}
		<div class="qr-preview">
			<QrCode
				value={SAMPLE_LINK}
				label=""
				center={centre === 'none' ? undefined : centre === 'picture' ? pictureMiddle : scriptMiddle}
				centerShape={centre === 'picture' ? 'square' : 'wide'}
				modules={preferences.current.qrModules}
				finders={preferences.current.qrFinders}
			/>
		</div>
	{/snippet}
	<QrCentreSetting />
</SettingGroup>

<!-- Your picture's square, empty until one is chosen. -->
{#snippet pictureMiddle()}{#if picture}<QrPicture />{/if}{/snippet}
{#snippet scriptMiddle()}<ScriptQrCenter logo={undefined} name="Trouble Brewing" />{/snippet}

<style>
	.qr-preview {
		width: min(100%, calc(12 * var(--u)));
		margin-inline: auto;
	}
</style>
