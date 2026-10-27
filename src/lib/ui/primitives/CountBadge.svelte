<script lang="ts">
	/**
	 * A small round count beside a heading (a check's jinxes, setup changes, warnings).
	 * `warn` turns it the accent colour when the count needs attention. One look for every
	 * count (component review §4.4, 2026-10-17: the Script builder and Setup check each had a
	 * copy). With `total`, a position such as the night order's "7 of 10" (Trevor, 2026-10-20:
	 * a badge, not loose text). Every worked-out number sits in one (Trevor, 2026-10-27: "in a
	 * colored circle, not loose in the air"; `grim/count-badge`), so it is always filled.
	 * `times` shows copies, "×3". Its size follows the font size around it.
	 */
	interface Props {
		/** The number, or a range such as "1–3" (how many an info token asks for). */
		count: number | string;
		total?: number;
		warn?: boolean;
		/** Copies of one thing, shown "×3". */
		times?: boolean;
		testid?: string;
	}

	let { count, total, warn = false, times = false, testid }: Props = $props();
	const text = $derived(
		total !== undefined ? `${count} of ${total}` : times ? `×${count}` : String(count)
	);
</script>

<span
	class="count-badge"
	data-warn={warn ? '' : undefined}
	data-total={total === undefined ? undefined : ''}
	data-testid={testid}>{text}</span
>

<style>
	.count-badge {
		display: inline-grid;
		place-items: center;
		min-width: 1.6em;
		height: 1.6em;
		padding: 0 0.3em;
		border-radius: var(--radius-full);
		box-sizing: border-box;
		/* --surface on --heading is a theme contrast pair, as the day's votes badge. */
		background: var(--heading);
		color: var(--surface);
		font-family: var(--font-control);
		font-weight: 700;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.count-badge[data-total] {
		padding: 0 0.6em;
	}
	.count-badge[data-warn] {
		background: var(--accent);
		color: var(--on-accent, var(--on-surface));
	}
</style>
