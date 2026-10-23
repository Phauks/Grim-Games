<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		reminderHolder,
		SYMBOL_COLOURS,
		type ReminderInstance,
		type SymbolColour
	} from '#lib/core/model/index.ts';
	import { SYMBOL_COLOUR_LOOKS } from './symbol-colour.ts';
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

	// Select drops an empty value, so None and Default need a word of their own.
	const NONE = 'none';
	const DEFAULT = 'default';
	const symbols = [
		{ value: NONE, label: 'None' },
		...TILE_SYMBOLS.map(({ icon, key }) => ({ value: icon, label: named(key), group: 'Symbols' })),
		...TILE_EMOJI.map(({ emoji, key }) => ({ value: emoji, label: named(key), group: 'Emoji' }))
	];
	function setSymbol(symbol: string) {
		if (!reminderHolder(grimoire.game, reminder.reminderId)) return;
		grimoire.run({
			type: 'SetReminderSymbol',
			reminderId: reminder.reminderId,
			symbol: symbol === NONE ? '' : symbol
		});
	}

	/**
	 * The symbol's colour (Trevor, 2026-10-20). Always there, so nothing moves; usable once the
	 * symbol is an icon, as an emoji keeps its own colours.
	 */
	const colours = [
		{ value: DEFAULT, label: 'Default' },
		...SYMBOL_COLOURS.map((c) => ({ value: c, label: SYMBOL_COLOUR_LOOKS[c].label }))
	];
	const iconSymbol = $derived(!!reminder.symbol?.startsWith('ph:'));
	function setColour(value: string) {
		if (!reminderHolder(grimoire.game, reminder.reminderId)) return;
		grimoire.run({
			type: 'SetReminderSymbolColour',
			reminderId: reminder.reminderId,
			colour: value === DEFAULT ? undefined : (value as SymbolColour)
		});
	}
</script>

<Select label="Symbol" value={reminder.symbol || NONE} options={symbols} onChange={setSymbol}>
	{#snippet item(option)}{@render choice(option)}{/snippet}
	{#snippet selected(option)}{@render choice(option)}{/snippet}
</Select>

<Select
	label="Symbol colour"
	value={reminder.symbolColour ?? DEFAULT}
	options={colours}
	onChange={setColour}
	disabled={!iconSymbol}
>
	{#snippet item(option)}{@render swatch(option)}{/snippet}
	{#snippet selected(option)}{@render swatch(option)}{/snippet}
</Select>

{#snippet swatch(option: { value: string; label: string })}
	<span class="choice"
		><span
			class="swatch"
			style:background={option.value !== DEFAULT
				? SYMBOL_COLOUR_LOOKS[option.value as SymbolColour].colour
				: 'var(--on-reminder)'}
		></span>{option.label}</span
	>
{/snippet}

{#snippet choice(option: { value: string; label: string })}
	<span class="choice"
		>{#if option.value.startsWith('ph:')}<TileMarkFace
				mark={{ kind: 'symbol', icon: option.value, name: option.label }}
			/>{:else if option.value !== NONE}<TileMarkFace
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
	.swatch {
		width: 1em;
		height: 1em;
		border: 0.0625rem solid var(--border);
		border-radius: 50%;
	}
	.choice :global(.mark) {
		font-size: 0.75em;
	}
</style>
