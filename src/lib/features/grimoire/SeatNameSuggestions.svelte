<!--
	The room's phones' names while a seat's name is edited, laid over the top of the seat
	sheet so nothing moves (the sheet's body is positioned for it).
-->
<script lang="ts">
	import type { SeatNameEdit } from '#lib/features/grimoire/seat-name-edit.svelte.ts';

	let { edit }: { edit: SeatNameEdit } = $props();
</script>

{#if edit.editing && edit.suggestions.length > 0}
	<div class="suggestions" aria-label="Name suggestions" role="group">
		{#each edit.suggestions as name (name)}
			<!-- Pressing a name keeps focus in the field, so it is not saved half-typed. -->
			<button
				type="button"
				class="chip"
				onpointerdown={(event) => event.preventDefault()}
				onclick={() => edit.finish(name)}>{name}</button
			>
		{/each}
	</div>
{/if}

<style>
	.suggestions {
		position: absolute;
		inset: 0 0 auto;
		z-index: 2;
		display: flex;
		gap: var(--space-1);
		padding: var(--space-1) 0;
		overflow-x: auto;
		scrollbar-width: none;
		background: var(--surface);
		box-shadow: 0 6px 8px -6px rgb(0 0 0 / 0.4); /* colour-ok: a shadow is darkness, not a theme colour */
	}
	.chip {
		flex: none;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: transparent;
		color: inherit;
		font-family: var(--font-player);
		cursor: pointer;
	}
</style>
