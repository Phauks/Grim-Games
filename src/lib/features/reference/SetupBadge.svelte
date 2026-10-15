<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import type { SetupModifier } from '#lib/core/rules/setup-modifiers.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		character: Character;
		setup: SetupModifier;
	}

	let { character, setup }: Props = $props();
	let open = $state(false);
</script>

<!-- A character that changes setup; what it changes opens in a dialog. -->
<button
	type="button"
	class="setup-badge"
	aria-haspopup="dialog"
	aria-label="Setup: {character.name} changes setup"
	data-testid="setup-badge"
	onclick={() => (open = true)}><span class="pill">Setup</span></button
>

<Dialog bind:open title="{character.name}: setup">
	<p class="summary" data-testid="setup-summary">{setup.summary}</p>
	{#each setup.notes as note (note)}<p class="note">{note}</p>{/each}
	{#if setup.source === 'ability-text'}
		<p class="note">Read from the ability’s [bracketed] text.</p>
	{/if}
</Dialog>

<style>
	/* A full-size tap target around a small pill. */
	.setup-badge {
		display: inline-grid;
		place-items: center;
		min-height: var(--tap-target);
		margin-block: calc((var(--tap-target) - 1.6em) / -2);
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
		vertical-align: middle;
	}
	.pill {
		padding: 0.1em 0.6em;
		border-radius: var(--radius-full);
		background: var(--accent);
		color: var(--on-accent, var(--on-surface));
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.summary {
		font-size: 1.1rem;
		font-weight: 600;
	}
	.note {
		color: var(--on-surface-muted);
	}
</style>
