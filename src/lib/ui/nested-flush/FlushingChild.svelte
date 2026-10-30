<script lang="ts">
	import { flushSync } from 'svelte';
	import { shared } from './shared.svelte.ts';

	// As zag does when an Ark part mounts: change state, then flush it at once.
	shared.count += 1;
	flushSync();
</script>

<p>Shown</p>
