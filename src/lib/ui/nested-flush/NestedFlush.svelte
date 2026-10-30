<script lang="ts">
	import FlushingChild from './FlushingChild.svelte';
	import { shared } from './shared.svelte.ts';

	let asked = $state(false);
	let show = $state(false);
	// An effect that opens a block, so Svelte reruns the block from inside its effect flush.
	$effect(() => {
		if (asked) show = true;
	});
</script>

<span hidden data-count={shared.count}></span>
<button type="button" onclick={() => (asked = true)}>Show</button>
{#if show}<FlushingChild />{/if}
