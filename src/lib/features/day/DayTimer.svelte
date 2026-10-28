<script lang="ts">
	import { SETUP_LOOKS } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { TIMER_FOR_PLAYERS, TIMER_SOUNDS, type TimerSound } from '#lib/ui/preferences.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import DayTimer from './DayTimer.svelte';
	import { liveDayTimer } from './day-timer.svelte.ts';
	import type { WatchedTimer } from './watched-timer.svelte.ts';
	import { hold } from '#lib/ui/hold.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { playSound } from '#lib/features/sound/sound.ts';
	import VibrateToggle from '#lib/features/sound/VibrateToggle.svelte';
	import { canKeepAwake } from './timer-wake-lock.ts';
	import TimerPerPlayerRow from './TimerPerPlayerRow.svelte';

	/**
	 * The day timer (Trevor, 2026-10-17): 30 seconds per living player (a setting since
	 * 2026-10-19), started by hand,
	 * counting down or up (a setting). At the target the device vibrates, plays the chosen
	 * sound and the clock flashes. `full` has every control (the day view); `compact` is the
	 * clock with Start/Pause, for the board. Tapping its clock opens the full timer and its
	 * settings over the board, without the day view (Trevor, 2026-10-17). Holding the clock
	 * resets it to the time per living player (Trevor, 2026-10-19).
	 */
	interface Props {
		/** Living players, for the starting length and Reset. */
		alive: number;
		variant?: 'full' | 'compact';
		/** False where the sound is chosen beside the timer (the board's timer sheet). */
		soundButton?: boolean;
		/**
		 * A spectator's board (Trevor, 2026-10-19): the clock is shown but nothing on it can
		 * be pressed, held or opened.
		 */
		readOnly?: boolean;
		/** Shown instead of this device's timer: the Storyteller's, on a spectator's board. */
		shown?: WatchedTimer;
	}

	let { alive, variant = 'full', soundButton = true, readOnly = false, shown }: Props = $props();

	/** This device's timer, which every button works; `shown` only shows. */
	const live = liveDayTimer;
	const timer = $derived(shown ?? live);
	$effect(() => live.follow(alive));

	let soundOpen = $state(false);
	let controlsOpen = $state(false);
	const soundLabel = (sound: TimerSound) => t(`day.timerSound.${sound}`);
	function chooseSound(sound: TimerSound) {
		preferences.update({ timerSound: sound });
		playSound(sound);
	}
</script>

{#snippet keepAwake()}
	<!-- The screen stays on while the timer runs (Trevor, 2026-10-19), so it can be followed
	     on a phone that would otherwise lock. Off and disabled, with why, where unsupported. -->
	<SettingToggle
		label={t('day.timerKeepAwake')}
		description={canKeepAwake() ? undefined : t('day.timerKeepAwakeUnavailable')}
		checked={canKeepAwake() && preferences.current.timerKeepAwake}
		disabled={!canKeepAwake()}
		onChange={(on) => live.setKeepAwake(on)}
	/>
{/snippet}

{#snippet forPlayers()}
	<!-- How players' phones show this timer in a live room (Trevor, 2026-10-26); also in
	     Settings > Storyteller > Day. -->
	<Select
		label={t('day.timerForPlayers')}
		value={preferences.current.timerForPlayers}
		options={TIMER_FOR_PLAYERS.map((value) => ({
			value,
			label: t(`day.timerForPlayers.${value}`)
		}))}
		onChange={(timerForPlayers) => preferences.update({ timerForPlayers })}
	/>
	<!-- What phones show beside Setup, before the first night (Trevor, 2026-10-28); also in
	     Settings > Storyteller > Day. -->
	<Select
		label={t('day.setupForPlayers')}
		value={preferences.current.setupForPlayers}
		options={SETUP_LOOKS.map((value) => ({ value, label: t(`day.setupForPlayers.${value}`) }))}
		onChange={(setupForPlayers) => preferences.update({ setupForPlayers })}
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
		<IconButton icon="minus" label={t('day.timerLess')} onclick={() => live.adjust(-1)} />
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
			{@attach hold(() => live.reset(alive))}
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
			disabled={readOnly}
			onclick={() => (controlsOpen = true)}
			{@attach hold(() => !readOnly && live.reset(alive))}
		>
			<span class="clock" role="timer" aria-live={timer.done ? 'assertive' : 'off'}
				>{timer.clock}</span
			>
		</button>
	{/if}
	{#if variant === 'full'}
		<IconButton icon="add" label={t('day.timerMore')} onclick={() => live.adjust(1)} />
	{/if}
	<IconButton
		icon={timer.running ? 'timerPause' : 'timerStart'}
		label={timer.running ? t('day.timerPause') : t('day.timerStart')}
		disabled={readOnly || (!timer.running && !timer.startable)}
		onclick={() => live.toggle()}
	/>
	{#if variant === 'full'}
		<IconButton
			icon="reset"
			label={t('day.timerReset')}
			disabled={timer.fresh}
			onclick={() => live.reset(alive)}
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
				disabled={preferences.current.timerMode === 'up'}
				onChange={chooseSound}
			/>
			<VibrateToggle />
			{@render keepAwake()}
			<TimerPerPlayerRow />
			{@render forPlayers()}
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
				disabled={preferences.current.timerMode === 'up'}
				onChange={chooseSound}
			/>
			<VibrateToggle />
			{@render keepAwake()}
			<TimerPerPlayerRow />
			{@render forPlayers()}
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
	/* On the board it looks like the toolbar's buttons: the same solid fill and edge, nothing
	   showing through (Trevor, 2026-10-23; GrimoireBoard.svelte gives them that fill). */
	.timer[data-variant='compact'] {
		border-color: var(--button-edge);
		background: var(--surface);
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
		color: var(--evil-text);
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
