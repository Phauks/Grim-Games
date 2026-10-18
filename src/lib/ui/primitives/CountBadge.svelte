<script lang="ts">
	/**
	 * A small round count beside a heading (a check's jinxes, setup changes, warnings).
	 * `warn` turns it the accent colour when the count needs attention. One look for every
	 * count (component review §4.4, 2026-10-17: the Script builder and Setup check each had a
	 * copy).
	 */
	interface Props {
		count: number;
		warn?: boolean;
		testid?: string;
	}

	let { count, warn = false, testid }: Props = $props();
</script>

<span class="count-badge" data-warn={warn ? '' : undefined} data-testid={testid}>{count}</span>

<style>
	.count-badge {
		display: inline-grid;
		place-items: center;
		min-width: 1.6em;
		height: 1.6em;
		padding: 0 0.3em;
		border-radius: var(--radius-full);
		background: var(--surface);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.count-badge[data-warn] {
		background: var(--accent);
		color: var(--on-accent, var(--on-surface));
	}
</style>
