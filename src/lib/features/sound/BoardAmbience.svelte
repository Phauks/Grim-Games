<script lang="ts">
	import { onDestroy } from 'svelte';
	import { ambience } from './ambience.ts';

	/** The night or day in play; null for none (Setup, an ended game, a spectator's board). */
	let { scene }: { scene: 'night' | 'day' | null } = $props();

	// Follows the scene and Settings > Sound as they change (plan U3).
	$effect(() => ambience.sync(scene));
	onDestroy(() => ambience.sync(null));
</script>
