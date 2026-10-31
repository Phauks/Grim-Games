<script lang="ts">
	/*
	 * A player's name, typed or picked from the room's phones (Trevor, 2026-10-19), so picking
	 * one seats that phone there (phones sit by name). The bag draw's reveal and Add late
	 * player use it (Trevor, 2026-10-31: "assign it to a phone with the same functionality").
	 */
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { suggestNames } from '#lib/features/grimoire/device-notes.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';

	interface Props {
		value: string;
		/** Names already on other seats, left out of the phones to pick from. */
		taken?: readonly string[];
		/** Shows the label only to screen readers, the placeholder saying what it is. */
		hideLabel?: boolean;
		/** The phones button's words: the player's own ("Pick your name") unless given. */
		pickLabel?: string;
	}

	let { value = $bindable(), taken = [], hideLabel = false, pickLabel }: Props = $props();
	const pick = $derived(pickLabel ?? t('setup.reveal.pickName'));

	// Only the room's phones, connected or asleep, without a seat in this game, never names
	// from earlier games (Trevor, 2026-10-26).
	const names = $derived(
		suggestNames(
			roomHost().unseatedInGame.flatMap((m) => (m.name ? [m.name] : [])),
			'',
			taken,
			Infinity
		)
	);
	let picking = $state(false);
</script>

<!-- Enter keeps the name and closes the phone keyboard. The phones button is always here,
     disabled when there are none: nothing moves. -->
<div class="player">
	<TextField
		label={t('setup.reveal.name')}
		bind:value
		{hideLabel}
		placeholder={hideLabel ? t('setup.reveal.name') : t('common.none')}
	/>
	<IconButton
		icon="players"
		label={pick}
		disabled={names.length === 0}
		onclick={() => (picking = true)}
	/>
</div>

<BottomSheet bind:open={picking} title={pick}>
	<ul class="names">
		{#each names as option (option)}
			<li>
				<button
					type="button"
					onclick={() => {
						value = option;
						picking = false;
					}}>{option}</button
				>
			</li>
		{/each}
	</ul>
</BottomSheet>

<style>
	.player {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: var(--space-2);
		min-width: 0;
		text-align: start;
	}
	/* A player's name is in the player font, as on their seat. */
	.player :global(.text-field input) {
		font-family: var(--font-player);
	}
	.names {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.names li + li {
		border-top: 1px solid var(--border);
	}
	/* A whole-row tap, in the player font as on a seat. */
	.names button {
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: 0;
		background: none;
		color: inherit;
		font-family: var(--font-player);
		font-size: 1.1rem;
		text-align: start;
	}
</style>
