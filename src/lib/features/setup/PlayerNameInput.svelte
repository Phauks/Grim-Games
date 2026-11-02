<script lang="ts">
	/*
	 * A player's name, typed or picked from the room's phones (Trevor, 2026-10-19), so picking
	 * one seats that phone there (phones sit by name). The bag draw's reveal and Add late
	 * player use it (Trevor, 2026-10-31: "assign it to a phone with the same functionality").
	 * One typable drop-down (Trevor, 2026-11-02: "i think i like the dropdown idea"): the
	 * room's names are its list, and any typed name is kept.
	 */
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { suggestNames } from '#lib/features/grimoire/device-notes.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import Combobox from '#lib/ui/primitives/Combobox.svelte';

	interface Props {
		value: string;
		/** Names already on other seats, left out of the phones to pick from. */
		taken?: readonly string[];
		/** Shows the label only to screen readers, the placeholder saying what it is. */
		hideLabel?: boolean;
		/** The empty field's words while there are phones to pick: the player's own ("Pick your name") unless given. */
		pickLabel?: string;
	}

	let { value = $bindable(), taken = [], hideLabel = false, pickLabel }: Props = $props();

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
	const placeholder = $derived(
		names.length > 0
			? (pickLabel ?? t('setup.reveal.pickName'))
			: hideLabel
				? t('setup.reveal.name')
				: t('common.none')
	);
</script>

<div class="player" data-testid="player-name-field">
	<Combobox
		free
		label={t('setup.reveal.name')}
		{hideLabel}
		{value}
		{placeholder}
		options={names.map((name) => ({ value: name, label: name }))}
		empty={t('common.none')}
		onChange={(next) => (value = next)}
	>
		{#snippet item(option)}<span class="name">{option.label}</span>{/snippet}
	</Combobox>
</div>

<style>
	.player {
		min-width: 0;
		text-align: start;
	}
	/* A player's name is in the player font, as on their seat. */
	.player :global([data-part='input']) {
		font-family: var(--font-player);
	}
	.name {
		font-family: var(--font-player);
		font-size: 1.1rem;
	}
</style>
