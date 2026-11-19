<script lang="ts">
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	/**
	 * How many copies one stacked reminder stands for ("Stack duplicate reminders", or a run's
	 * tokens), on its top right: the reminder bank, the Board settings preview and a seat's
	 * stacks on the board (board-stacks.ts).
	 */
	let { count }: { count: number } = $props();
</script>

<span class="count" aria-label={`${count} copies`}><CountBadge {count} times warn /></span>

<style>
	.count {
		position: absolute;
		top: 0;
		right: 0;
		z-index: var(--z-above);
		display: flex;
		font-size: 0.75rem;
		pointer-events: none;
	}
</style>
