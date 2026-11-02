<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { clock, timeLeft } from './time-left.svelte.ts';

	/**
	 * The time left on the script vote (Trevor, 2026-10-23: "storyteller can create
	 * time-limit for vote"), on the Storyteller's sheet and on each phone's ballot. It counts
	 * down each second on this device's clock; the room's own clock decides when ballots stop.
	 * Room transfer's code counts down with it too, in its own words (`text`).
	 */
	interface Props {
		/** When the time limit runs out (epoch ms); nothing shows without one. */
		endsAt: number | undefined;
		/** Told whether the time is up, for the caller to stop taking taps. */
		onEnded?: (ended: boolean) => void;
		/** Its own words for the time left ("4:52"), in place of the vote's. */
		text?: (time: string) => string;
		/** Its own words once the time is up. */
		endedText?: string;
		testid?: string;
	}

	let { endsAt, onEnded, text, endedText, testid = 'script-vote-time' }: Props = $props();

	const countdown = timeLeft(() => endsAt);
	const left = $derived(countdown.ms);
	$effect(() => onEnded?.(left === 0));
</script>

{#if left !== undefined}
	<p class="time-left" data-testid={testid} data-ended={left === 0 || undefined}>
		{left === 0
			? (endedText ?? t('room.scriptVote.ended'))
			: text
				? text(clock(left))
				: t('room.scriptVote.timeLeft', {
						time: clock(left)
					})}
	</p>
{/if}

<style>
	.time-left {
		margin: 0 0 var(--space-3);
		font-variant-numeric: tabular-nums;
		color: var(--on-surface-muted);
	}
	.time-left[data-ended] {
		color: var(--on-surface);
		font-weight: 600;
	}
</style>
