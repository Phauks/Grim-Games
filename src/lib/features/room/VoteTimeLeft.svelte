<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';

	/**
	 * The time left on the script vote (Trevor, 2026-10-23: "storyteller can create
	 * time-limit for vote"), on the Storyteller's sheet and on each phone's ballot. It counts
	 * down each second on this device's clock; the room's own clock decides when ballots stop.
	 */
	interface Props {
		/** When the time limit runs out (epoch ms); nothing shows without one. */
		endsAt: number | undefined;
		/** The Storyteller ended the vote early: the last seconds say so (Trevor, 2026-10-26). */
		finalCall?: boolean;
		/** Told whether the time is up, for the caller to stop taking taps. */
		onEnded?: (ended: boolean) => void;
	}

	let { endsAt, finalCall = false, onEnded }: Props = $props();

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
		data-testid="script-vote-time"
		data-ended={left === 0 || undefined}
		data-final={(finalCall && left > 0) || undefined}
	>
		{left === 0
			? t('room.scriptVote.ended')
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
