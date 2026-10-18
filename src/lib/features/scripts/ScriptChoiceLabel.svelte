<script lang="ts">
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';

	/**
	 * A script's name in a list of scripts to choose (New game), with its author and version
	 * on one line under it where the script has them (Trevor, 2026-10-18).
	 */
	interface Props {
		label: string;
		author?: string;
		version?: string;
	}

	let { label, author, version }: Props = $props();
</script>

<span class="choice">
	<span>{label}</span>
	<ScriptByline {author} {version} inline />
</span>

<style>
	.choice {
		display: grid;
		min-width: 0;
	}
	.choice > :global(*) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.choice :global(.byline) {
		font-size: 0.8em;
	}
</style>
