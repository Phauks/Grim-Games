<!--
	The seat sheet's heading: the player's name, or the field that edits it in place.
-->
<script lang="ts">
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { SeatNameEdit } from '#lib/features/grimoire/seat-name-edit.svelte.ts';

	interface Props {
		edit: SeatNameEdit;
		/** Shown in an empty field ("Seat 3"). */
		placeholder: string;
	}

	let { edit, placeholder }: Props = $props();

	let input = $state<HTMLInputElement>();
	$effect(() => {
		if (edit.editing) input?.focus();
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		edit.finish();
	}
</script>

{#if edit.editing}
	<!-- A form, so a phone keyboard's Done or Enter key submits it even when the key
		 press arrives without key events (Android keyboards). -->
	<form class="name-form" onsubmit={submit}>
		<ClearableField bind:value={edit.typed}>
			<input
				bind:this={input}
				class="name-input"
				type="text"
				aria-label="Player name"
				autocomplete="off"
				enterkeyhint="done"
				{placeholder}
				bind:value={edit.typed}
				onkeydown={(event) => edit.cancel(event)}
				onblur={() => edit.finish()}
			/>
		</ClearableField>
	</form>
{:else}
	<span class="player-name" class:no-name={!edit.saved}
		>{#if edit.saved}<PlayerBadge name={edit.saved} />{:else}No name{/if}</span
	>
{/if}

<style>
	.name-form {
		display: contents;
	}
	.no-name {
		color: var(--on-surface-muted);
	}
	.player-name {
		font-size: 1.05rem;
	}
	/* The same box as the name it replaces. */
	.name-input {
		box-sizing: border-box;
		width: 100%;
		height: 1.6em;
		margin: 0;
		padding: 0 var(--space-1);
		border: 0;
		border-bottom: 2px solid var(--accent);
		border-radius: 0;
		background: var(--surface-raised);
		color: inherit;
		font: inherit;
		letter-spacing: inherit;
	}
</style>
