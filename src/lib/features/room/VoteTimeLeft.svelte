<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';

	/**
	 * The time left on the script vote (Trevor, 2026-10-23: "storyteller can create
	 * time-limit for vote"), on the Storyteller's sheet and on each phone's ballot. It counts
	 * down each second on this device's clock; the room's own clock decides when ballots stop.
	 * Room transfer's code counts down with it too, in its own words (`text`).
	 */
	interface Props {
		/** When the time limit runs out (epoch ms); nothing shows without one. */
		endsAt: number | undefined;
		/** The Storyteller ended the vote early: the last seconds say so (Trevor, 2026-10-26). */
		finalCall?: boolean;
		/** Told whether the time is up, for the caller to stop taking taps. */
		onEnded?: (ended: boolean) => void;
		/** Its own words for the time left ("4:52"), in place of the vote's. */
		text?: (time: string) => string;
		/** Its own words once the time is up. */
		endedText?: string;
		testid?: string;
	}

	let {
		endsAt,
		finalCall = false,
		onEnded,
		text,
		endedText,
		testid = 'script-vote-time'
	}: Props = $props();

	let now = $state(Date.now());
	$effect(() => {
		if (endsAt === undefined) return;
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
	const left = $derived(endsAt === undefined ? undefined : Math.max(0, endsAt - now));
	$effect(() => onEnded?.(left === 0));
	const clock = (ms: number) => {
		const seconds = Math.ceil(ms / 1000);
		return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
	};
</script>

{#if left !== undefined}
	<p
		class="time-left"
		data-testid={testid}
		data-ended={left === 0 || undefined}
		data-final={(finalCall && left > 0) || undefined}
	>
		{left === 0
			? (endedText ?? t('room.scriptVote.ended'))
			: text
				? text(clock(left))
				: t(finalCall ? 'room.scriptVote.finalCall' : 'room.scriptVote.timeLeft', {
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
	.time-left[data-ended],
	.time-left[data-final] {
		color: var(--on-surface);
		font-weight: 600;
	}
</style>
