<script lang="ts">
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import { scriptLogo } from '#lib/core/data/script-logo.ts';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';

	/**
	 * A script's name as the player's script shows it at the top of /play: its logo, when it has
	 * one, then the name at the page title's size (Trevor, 2026-10-24: "It needs to look like it
	 * would for players view of the script"). For a copy of the script away from /play.
	 */
	interface Props {
		script: Pick<LoadedScript, 'name' | 'edition' | 'meta'>;
	}

	let { script }: Props = $props();

	const logo = $derived(scriptLogo(script));
	let logoFailed = $state(false);
	$effect(() => {
		void logo;
		logoFailed = false;
	});
</script>

<h3 class="script-title" data-testid="script-copy-title">
	{#if logo && !logoFailed}<ScriptLogo
			src={logo}
			class="script-title-logo"
			onfail={() => (logoFailed = true)}
		/>{/if}{script.name}
</h3>

<style>
	/* Page's h1, which /play's title is. */
	.script-title {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		margin: 0;
		font-size: var(--page-title-size);
		overflow-wrap: anywhere;
		hyphens: auto;
	}
	/* /play's title logo (PlayerView). */
	.script-title :global(.script-title-logo) {
		flex: none;
		width: 1.8em;
		height: 1.8em;
	}
</style>
