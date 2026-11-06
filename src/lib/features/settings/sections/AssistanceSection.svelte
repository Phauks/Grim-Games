<script lang="ts">
	import { tileFaceOptions } from '#lib/features/setup/tile-face.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { ASSIST_LABELS, type AssistKey } from '#lib/ui/assistance.ts';
	import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
	import { canKeepAwake } from '#lib/features/day/timer-wake-lock.ts';
	import TimerPerPlayerRow from '#lib/features/day/TimerPerPlayerRow.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { COUNTING_REMINDERS, REMINDER_REMOVALS } from '#lib/ui/preferences.ts';
	import { gameSettings } from '#lib/features/game-settings/game-settings.svelte.ts';
	import BagDrawRows from '#lib/features/game-settings/BagDrawRows.svelte';
	import { SETUP_LOOKS } from '#lib/core/rules/index.ts';
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
	import { page } from '$app/state';
	import { drawLock } from '#lib/features/setup/draw-lock.svelte.ts';
	import PinDialog from '#lib/features/setup/PinDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';

	/** A room's join link, as the share screen's QR carries, for the preview only. */
	const SAMPLE_LINK = 'https://grimbinder.com/join/123456';
	const centre = $derived(preferences.current.qrCentre);
	const picture = $derived(centre === 'picture' && !!qrPicture.current);

	const assistance = $derived(preferences.current.assistance);

	/** The open game's PIN: Settings over a game's screens (the board, its draw) can change it. */
	const gameId = $derived(page.params.gameId);
	const hasPin = $derived(gameId ? drawLock.hasPin(gameId) : false);
	const drawLocked = $derived(gameId ? drawLock.isLocked(gameId) : false);
	/** What the old PIN, once given, goes on to do. */
	let pinAsk = $state<'change' | 'remove'>('change');
	let pinAskOpen = $state(false);
	let pinSetOpen = $state(false);
</script>

<!-- Every Storyteller-only setting, under plain headings so the list scans (Trevor, 2026-10-17). -->
{#snippet toggle(key: AssistKey)}
	<SettingToggle
		label={ASSIST_LABELS[key].label}
		description={ASSIST_LABELS[key].description}
		checked={key === 'trackNominations' ? gameSettings.current.trackNominations : assistance[key]}
		onChange={(checked) =>
			key === 'trackNominations'
				? gameSettings.setDefault({ trackNominations: checked })
				: preferences.update({ assistance: { ...assistance, [key]: checked } })}
	/>
{/snippet}

<SettingHeading title={t('settings.groupNight')} first />
{#each STORYTELLER_GROUPS.night as key (key)}{@render toggle(key)}{/each}

<!-- Setup: what players' phones show while it runs, and how game modes are described (Trevor,
     2026-11-06: moved out of Day and Bag draw). -->
<SettingHeading title={t('settings.groupSetupPhase')} />
<SettingSelect
	label={t('day.setupForPlayers')}
	value={gameSettings.current.setupForPlayers}
	options={SETUP_LOOKS.map((value) => ({ value, label: t(`day.setupForPlayers.${value}`) }))}
	defaultValue="candles"
	onChange={(setupForPlayers) => gameSettings.setDefault({ setupForPlayers })}
/>
<SettingToggle
	label={t('settings.ownWording')}
	description={t('settings.ownWordingHelp')}
	checked={preferences.current.ownWording}
	onChange={(ownWording) => preferences.update({ ownWording })}
/>

<SettingHeading title={t('settings.groupSetup')} />
<!-- What face-down bag tiles show (Trevor, 2026-10-16: a dropdown, not a switch). -->
<SettingSelect
	label={t('settings.tileLabels')}
	value={preferences.current.tileFace}
	options={tileFaceOptions()}
	defaultValue="numbers"
	onChange={(tileFace) => preferences.update({ tileFace })}
/>
<BagDrawRows values={gameSettings.current} onChange={(change) => gameSettings.setDefault(change)} />

<SettingHeading title={t('settings.groupDay')} />
{#each STORYTELLER_GROUPS.day as key (key)}{@render toggle(key)}{/each}

<!-- Reminders going on and coming off the board, at any time of day (Trevor, 2026-11-06). -->
<SettingHeading title={t('settings.groupReminders')} />
<!-- Reminders that run out at dawn or dusk (Trevor, 2026-11-03: off by default). -->
<SettingSelect
	label={t('settings.reminderRemoval')}
	description={t('settings.reminderRemovalHelp')}
	value={preferences.current.reminderRemoval}
	options={REMINDER_REMOVALS.map((value) => ({
		value,
		label: t(`settings.reminderRemoval.${value}`)
	}))}
	defaultValue="off"
	onChange={(reminderRemoval) => preferences.update({ reminderRemoval })}
/>
<!-- Day and night counters and number tokens that count up (plan M53, Trevor 2026-11-04). -->
<SettingSelect
	label={t('settings.countingReminders')}
	description={t('settings.countingRemindersHelp')}
	value={preferences.current.countingReminders}
	options={COUNTING_REMINDERS.map((value) => ({
		value,
		label: t(`settings.countingReminders.${value}`)
	}))}
	defaultValue="off"
	onChange={(countingReminders) => preferences.update({ countingReminders })}
/>
{#each STORYTELLER_GROUPS.reminders as key (key)}{@render toggle(key)}{/each}

<!-- The day timer's own choices, the same values as on the timer (Trevor, 2026-10-17), under
     the heading Sound uses (Trevor, 2026-11-06); its sound and vibration are in Settings > Sound
     (plan U1). Two states, so a switch: on counts up as a stopwatch. -->
<SettingHeading title={t('day.timer')} />
<SettingToggle
	label={t('day.timerKeepAwake')}
	description={canKeepAwake() ? undefined : t('day.timerKeepAwakeUnavailable')}
	checked={canKeepAwake() && preferences.current.timerKeepAwake}
	disabled={!canKeepAwake()}
	onChange={(on) => liveDayTimer.setKeepAwake(on)}
/>
<SettingToggle
	label={t('day.timerModeUp')}
	checked={preferences.current.timerMode === 'up'}
	onChange={(on) => preferences.update({ timerMode: on ? 'up' : 'down' })}
/>
<TimerPerPlayerRow />

<!-- Every PIN and lock in one place (Trevor, 2026-10-27: "do we need better centralized PIN
     controls"): the cover's switch, also on the cover itself, and the game's Storyteller PIN,
     which the locked draw and the cover share (draw-lock.svelte.ts). -->
<SettingHeading title={t('settings.groupPins')} />
<SettingToggle
	label={t('settings.coverPin')}
	description={t('settings.coverPinHelp')}
	checked={preferences.current.coverPin}
	onChange={(coverPin) => preferences.update({ coverPin })}
/>
<SettingRow
	label={t('settings.storytellerPin')}
	description={!gameId
		? t('settings.storytellerPinNoGame')
		: hasPin
			? t('settings.storytellerPinSet')
			: t('settings.storytellerPinNone')}
>
	{#snippet control(labelId)}
		<span class="pin-actions" role="group" aria-labelledby={labelId}>
			<Button
				variant="quiet"
				disabled={!gameId}
				onclick={() => {
					if (!hasPin) pinSetOpen = true;
					else {
						pinAsk = 'change';
						pinAskOpen = true;
					}
				}}>{hasPin ? t('settings.changePin') : t('settings.setPin')}</Button
			>
			<!-- Not while the draw is locked: that would unlock it without the PIN. -->
			<DeleteButton
				label={t('settings.removePin')}
				disabled={!gameId || !hasPin || drawLocked}
				onclick={() => {
					pinAsk = 'remove';
					pinAskOpen = true;
				}}
			/>
		</span>
	{/snippet}
</SettingRow>
{#if gameId}
	<!-- The old PIN first, then the new one; Forgot PIN on the pad clears it as ever. -->
	<PinDialog
		bind:open={pinAskOpen}
		{gameId}
		purpose="cover"
		onDone={() => {
			if (pinAsk === 'change') pinSetOpen = true;
			else if (gameId) drawLock.clear(gameId);
		}}
	/>
	<PinDialog bind:open={pinSetOpen} {gameId} mode="set" purpose="cover" />
{/if}

<SettingHeading title={t('settings.groupShare')} />
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
	.pin-actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.qr-preview {
		width: min(100%, calc(12 * var(--u)));
		margin-inline: auto;
	}
</style>
