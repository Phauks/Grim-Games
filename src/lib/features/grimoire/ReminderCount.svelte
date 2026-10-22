<script lang="ts">
	/**
	 * How many copies one stacked reminder stands for ("Stack duplicate reminders"), on its
	 * top right: the reminder bank and the Board settings preview.
	 */
	let { count }: { count: number } = $props();
</script>

<span class="count" aria-label={`${count} copies`}>×{count}</span>

<style>
	.count {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 1;
		min-width: 1.4em;
		padding: 0 calc(0.1875 * var(--u));
		border-radius: var(--radius-full);
		background: var(--accent);
		color: var(--on-accent);
		font: 700 0.75rem / 1.4 var(--font-control);
		text-align: center;
		pointer-events: none;
	}
</style>
