<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { TIMER_SOUNDS, type TimerSound } from '#lib/ui/preferences.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import DayTimer from './DayTimer.svelte';
	import { liveDayTimer as timer } from './day-timer.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { canVibrate, playTimerSound, vibrateTimer } from './timer-sound.ts';
	import { canKeepAwake } from './timer-wake-lock.ts';
	import TimerPerPlayerRow from './TimerPerPlayerRow.svelte';

	/**
	 * The day timer (Trevor, 2026-10-17): 30 seconds per living player (a setting since
	 * 2026-10-19), started by hand,
	 * counting down or up (a setting). At the target the device vibrates, plays the chosen
	 * sound and the clock flashes. `full` has every control (the day view); `compact` is the
	 * clock with Start/Pause, for the board. Tapping its clock opens the full timer and its
	 * settings over the board, without the day view (Trevor, 2026-10-17).
	 */
	interface Props {
		/** Living players, for the starting length and Reset. */
		alive: number;
		variant?: 'full' | 'compact';
		/** False where the sound is chosen beside the timer (the board's timer sheet). */
		soundButton?: boolean;
	}

	let { alive, variant = 'full', soundButton = true }: Props = $props();

	$effect(() => timer.follow(alive));

	let soundOpen = $state(false);
	let controlsOpen = $state(false);
	const soundLabel = (sound: TimerSound) => t(`day.timerSound.${sound}`);
	/** Vibration on or off beside the sound, so the alarm can be either, both or neither. */
	function chooseVibrate(timerVibrate: boolean) {
		preferences.update({ timerVibrate });
		if (timerVibrate) vibrateTimer();
	}
	function chooseSound(sound: TimerSound) {
		preferences.update({ timerSound: sound });
		playTimerSound(sound);
	}
</script>

{#snippet vibrate()}
	<!-- Vibration or the sound, both or neither (Trevor, 2026-10-18). Shown off and disabled,
	     with why, on devices that cannot vibrate, so the sheet looks the same everywhere. -->
	<SettingToggle
		label={t('day.timerVibrate')}
		description={canVibrate() ? undefined : t('day.timerVibrateUnavailable')}
		checked={canVibrate() && preferences.current.timerVibrate}
		disabled={!canVibrate()}
		onChange={chooseVibrate}
	/>
{/snippet}

{#snippet keepAwake()}
	<!-- The screen stays on while the timer runs (Trevor, 2026-10-19), so it can be followed
	     on a phone that would otherwise lock. Off and disabled, with why, where unsupported. -->
	<SettingToggle
		label={t('day.timerKeepAwake')}
		description={canKeepAwake() ? undefined : t('day.timerKeepAwakeUnavailable')}
		checked={canKeepAwake() && preferences.current.timerKeepAwake}
		disabled={!canKeepAwake()}
		onChange={(on) => timer.setKeepAwake(on)}
	/>
{/snippet}

<div
	class="timer"
	data-variant={variant}
	role="group"
	aria-label={t('day.timer')}
	data-testid="day-timer"
	data-running={timer.running ? '' : undefined}
	data-done={timer.done ? '' : undefined}
>
	{#if variant === 'full'}
		<IconButton icon="minus" label={t('day.timerLess')} onclick={() => timer.adjust(-1)} />
	{/if}
	{#if variant === 'full'}
		<!--
			The mode is named on the timer's top edge (Trevor, 2026-10-17: "small text that
			denotes timer or stopwatch", no extra space); tapping the clock switches it.
		-->
		<button
			type="button"
			class="mode"
			aria-label={timer.mode === 'down' ? t('day.timerSwitchToUp') : t('day.timerSwitchToDown')}
			onclick={() => preferences.update({ timerMode: timer.mode === 'down' ? 'up' : 'down' })}
		>
			<span class="caption" data-testid="timer-mode" aria-hidden="true"
				>{timer.mode === 'down' ? t('day.timerModeDown') : t('day.timerModeUp')}</span
			>
			<span class="clock" role="timer" aria-live={timer.done ? 'assertive' : 'off'}
				>{timer.clock}</span
			>
		</button>
	{:else}
		<button
			type="button"
			class="open"
			aria-label={t('day.timerOpen', { clock: timer.clock })}
			onclick={() => (controlsOpen = true)}
		>
			<span class="clock" role="timer" aria-live={timer.done ? 'assertive' : 'off'}
				>{timer.clock}</span
			>
		</button>
	{/if}
	{#if variant === 'full'}
		<IconButton icon="add" label={t('day.timerMore')} onclick={() => timer.adjust(1)} />
	{/if}
	<IconButton
		icon={timer.running ? 'timerPause' : 'timerStart'}
		label={timer.running ? t('day.timerPause') : t('day.timerStart')}
		disabled={!timer.running && !timer.startable}
		onclick={() => timer.toggle()}
	/>
	{#if variant === 'full'}
		<IconButton
			icon="reset"
			label={t('day.timerReset')}
			disabled={timer.fresh}
			onclick={() => timer.reset(alive)}
		/>
		{#if soundButton}
			<IconButton
				icon="sound"
				label={t('day.timerSoundButton', { sound: soundLabel(preferences.current.timerSound) })}
				onclick={() => (soundOpen = true)}
			/>
		{/if}
	{/if}
</div>

{#if variant === 'full'}
	<BottomSheet bind:open={soundOpen} title={t('day.timerSoundTitle')}>
		<div class="controls">
			<!-- A drop-down; each choice plays, cutting off the one before (Trevor, 2026-10-17). -->
			<Select
				label={t('day.timerSoundTitle')}
				hideLabel
				value={preferences.current.timerSound}
				options={TIMER_SOUNDS.map((value) => ({ value, label: soundLabel(value) }))}
				onChange={chooseSound}
			/>
			{@render vibrate()}
			{@render keepAwake()}
			<TimerPerPlayerRow />
		</div>
	</BottomSheet>
{:else}
	<!-- The timer's own controls and settings, over the board; nothing leads to Settings. -->
	<BottomSheet bind:open={controlsOpen} title={t('day.timer')}>
		<div class="controls" data-testid="timer-sheet">
			<DayTimer {alive} soundButton={false} />
			<Select
				label={t('day.timerSoundTitle')}
				value={preferences.current.timerSound}
				options={TIMER_SOUNDS.map((value) => ({ value, label: soundLabel(value) }))}
				onChange={chooseSound}
			/>
			{@render vibrate()}
			{@render keepAwake()}
			<TimerPerPlayerRow />
		</div>
	</BottomSheet>
{/if}

<style>
	.timer {
		position: relative;
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--dialog-background, var(--surface));
		/* Its own text colour, so the clock reads on its background inside any sheet. */
		color: var(--on-surface);
	}
	/* Fixed width in digits, so ticking never moves the buttons. */
	.clock {
		min-width: 4.5ch;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		text-align: center;
	}
	.open {
		align-self: stretch;
		min-width: var(--tap-target);
		padding: 0;
		border: 0;
		border-radius: var(--radius-full);
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	/* The clock's button is only part of the timer, so the keyboard ring goes round the whole
	   timer and follows its pill shape, not round the clock alone (Trevor, 2026-10-18). */
	.open:focus-visible,
	.mode:focus-visible {
		outline: none;
	}
	.timer:has(> .open:focus-visible, > .mode:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.controls {
		--timer-surround: var(--sheet-background);
		--timer-surround-muted: var(--on-surface-muted);
		display: grid;
		gap: var(--space-4);
		padding-top: var(--space-2);
	}
	/* On the board the clock comes first, so it keeps clear of the rounded edge (Trevor). */
	.timer[data-variant='compact'] .clock {
		padding-inline-start: var(--space-3);
	}
	.timer[data-variant='full'] {
		container-type: inline-size;
		justify-content: space-between;
		width: 100%;
	}
	.timer > :global(*) {
		flex-shrink: 0;
	}
	.mode {
		flex: 1 1 0;
		min-width: 0;
		align-self: stretch;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	/* Shrinks on narrow phones with large text, so the five buttons and the clock always fit
	   (5ch of digits in what the buttons leave). */
	.timer[data-variant='full'] .clock {
		display: block;
		font-size: min(2.25rem, calc((100cqi - 5 * var(--tap-target)) * 0.35));
		line-height: 1.1;
	}
	/* Sits on the timer's top border, like a legend, so it takes no height. */
	.caption {
		position: absolute;
		top: 0;
		left: 50%;
		padding: 0 var(--space-2);
		/* Matches what is around the timer, so it reads as cut into the border. */
		background: var(--timer-surround, var(--dialog-background, var(--surface)));
		color: var(--timer-surround-muted, var(--on-surface-muted));
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		line-height: 1;
		text-transform: uppercase;
		white-space: nowrap;
		transform: translate(-50%, -50%);
	}
	.timer[data-done] {
		border-color: var(--evil);
	}
	.timer[data-done] .clock {
		color: var(--evil);
		animation: time-up 1s steps(2, jump-none) infinite;
	}
	@keyframes time-up {
		to {
			opacity: 0.3;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.timer[data-done] .clock {
			animation: none;
		}
	}
</style>
