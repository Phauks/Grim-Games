<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { TIMER_SOUNDS, type TimerSound } from '#lib/ui/preferences.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { liveDayTimer as timer } from './day-timer.svelte.ts';
	import { playTimerSound } from './timer-sound.ts';

	/**
	 * The day timer (Trevor, 2026-10-17): 30 seconds per living player, started by hand,
	 * counting down or up (a setting). At the target the device vibrates, plays the chosen
	 * sound and the clock flashes. `full` has every control (the day view); `compact` is the
	 * clock with Start/Pause, for the board.
	 */
	interface Props {
		/** Living players, for the starting length and Reset. */
		alive: number;
		variant?: 'full' | 'compact';
	}

	let { alive, variant = 'full' }: Props = $props();

	$effect(() => timer.follow(alive));

	let soundOpen = $state(false);
	const soundLabel = (sound: TimerSound) => t(`day.timerSound.${sound}`);
	function chooseSound(sound: TimerSound) {
		preferences.update({ timerSound: sound });
		playTimerSound(sound);
	}
</script>

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
		<span class="clock" role="timer" aria-live={timer.done ? 'assertive' : 'off'}
			>{timer.clock}</span
		>
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
		<IconButton
			icon="sound"
			label={t('day.timerSoundButton', { sound: soundLabel(preferences.current.timerSound) })}
			onclick={() => (soundOpen = true)}
		/>
	{/if}
</div>

{#if variant === 'full'}
	<BottomSheet bind:open={soundOpen} title={t('day.timerSoundTitle')}>
		<ChoiceGroup
			label={t('day.timerSoundTitle')}
			hideLabel
			value={preferences.current.timerSound}
			options={TIMER_SOUNDS.map((value) => ({ value, label: soundLabel(value) }))}
			onChange={chooseSound}
		/>
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
	}
	/* Fixed width in digits, so ticking never moves the buttons. */
	.clock {
		min-width: 4.5ch;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		text-align: center;
	}
	.timer[data-variant='full'] {
		justify-content: space-between;
		width: 100%;
	}
	.mode {
		flex: 1;
		align-self: stretch;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.timer[data-variant='full'] .clock {
		display: block;
		font-size: 2.25rem;
		line-height: 1.1;
	}
	/* Sits on the timer's top border, like a legend, so it takes no height. */
	.caption {
		position: absolute;
		top: 0;
		left: 50%;
		padding: 0 var(--space-2);
		background: var(--dialog-background, var(--surface));
		color: var(--on-surface-muted);
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
