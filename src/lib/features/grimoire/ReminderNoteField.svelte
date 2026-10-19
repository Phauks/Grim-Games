<script lang="ts">
	import { onDestroy } from 'svelte';
	import { reminderHolder, type ReminderInstance } from '#lib/core/model/index.ts';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { named, TILE_EMOJI, TILE_SYMBOLS } from '#lib/features/setup/tile-face.ts';
	import TileMarkFace from '#lib/features/setup/TileMarkFace.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * The generic reminder's own symbol and text. The symbol (Trevor, 2026-10-19: chosen per
	 * token) is nothing, one of the bag tiles' symbols, or one of their emoji. The text (Trevor, 2026-10-18: "if you touch it, you can add more
	 * information"), in its reminder sheet. Enter saves it, and so does closing the sheet;
	 * emptied, the token goes back to a plain ∞.
	 */
	interface Props {
		grimoire: Grimoire;
		reminder: ReminderInstance;
	}

	let { grimoire, reminder }: Props = $props();
	// eslint-disable-next-line svelte/prefer-writable-derived -- edited here, saved on commit
	let text = $state('');
	$effect.pre(() => {
		text = reminder.note ?? '';
	});

	function save() {
		const note = text.trim();
		// Already taken off the board: nothing to save it on.
		if (note === (reminder.note ?? '') || !reminderHolder(grimoire.game, reminder.reminderId))
			return;
		grimoire.run({ type: 'SetReminderNote', reminderId: reminder.reminderId, note });
	}
	onDestroy(save);

	const symbols = [
		{ value: '', label: 'None' },
		...TILE_SYMBOLS.map(({ icon, key }) => ({ value: icon, label: named(key), group: 'Symbols' })),
		...TILE_EMOJI.map(({ emoji, key }) => ({ value: emoji, label: named(key), group: 'Emoji' }))
	];
	function setSymbol(symbol: string) {
		if (!reminderHolder(grimoire.game, reminder.reminderId)) return;
		grimoire.run({ type: 'SetReminderSymbol', reminderId: reminder.reminderId, symbol });
	}
</script>

<Select label="Symbol" value={reminder.symbol ?? ''} options={symbols} onChange={setSymbol}>
	{#snippet item(option)}{@render choice(option)}{/snippet}
	{#snippet selected(option)}{@render choice(option)}{/snippet}
</Select>

{#snippet choice(option: { value: string; label: string })}
	<span class="choice"
		>{#if option.value.startsWith('ph:')}<TileMarkFace
				mark={{ kind: 'symbol', icon: option.value, name: option.label }}
			/>{:else if option.value}<TileMarkFace
				mark={{ kind: 'emoji', emoji: option.value, name: option.label }}
			/>{/if}{option.label}</span
	>
{/snippet}

<TextField
	label="Text"
	bind:value={text}
	maxlength={60}
	enterkeyhint="done"
	oncommit={save}
	testid="reminder-note"
/>

<style>
	.choice {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.choice :global(.mark) {
		font-size: 0.75em;
	}
</style>
