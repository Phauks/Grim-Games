<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';

	// trim: fit the line box to the capitals, so the name centres on an icon beside it by eye.
	let { trim = false }: { trim?: boolean } = $props();
</script>

<!-- The app's name drawn as its wordmark, the same wherever it appears: the sidebar's top left
     and the About intro (Trevor, 2026-11-16). Sized by its surroundings. -->
<span class="app-name" class:trim>{APP_NAME}</span>

<style>
	.app-name {
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		letter-spacing: 0.06em;
		color: var(--heading);
	}
	/* All capitals: trim the line box to them. */
	.trim {
		text-box: trim-both cap alphabetic;
		padding-block: 0.1em;
	}
</style>
