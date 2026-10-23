<script lang="ts">
	import { onDestroy } from 'svelte';
	import { SYMBOL_COLOURS, type GenericLook, type SymbolColour } from '#lib/core/model/index.ts';
	import { SYMBOL_COLOUR_LOOKS } from './symbol-colour.ts';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { named, TILE_EMOJI, TILE_SYMBOLS } from '#lib/features/setup/tile-face.ts';
	import TileMarkFace from '#lib/features/setup/TileMarkFace.svelte';

	/**
	 * A generic ∞ token's symbol, symbol colour and text, for a placed reminder
	 * (ReminderNoteField) and for the bank's reusable ∞ tokens (GenericTokenDialog). The symbol
	 * (Trevor, 2026-10-19: chosen per token) is nothing, one of the bag tiles' symbols, or one
	 * of their emoji. The text (Trevor, 2026-10-18: "if you touch it, you can add more
	 * information"): Enter saves it, and so does closing; emptied, the token goes back to a
	 * plain ∞.
	 */
	interface Props {
		look: GenericLook;
		onNote: (note: string) => void;
		/** Blank clears it. */
		onSymbol: (symbol: string) => void;
		/** None is the reminder's own ink. */
		onColour: (colour: SymbolColour | undefined) => void;
		onFill: (fill: boolean) => void;
	}

	let { look, onNote, onSymbol, onColour, onFill }: Props = $props();
	// eslint-disable-next-line svelte/prefer-writable-derived -- edited here, saved on commit
	let text = $state('');
	$effect.pre(() => {
		text = look.note ?? '';
	});

	function save() {
		const note = text.trim();
		if (note !== (look.note ?? '')) onNote(note);
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

	/**
	 * The symbol's colour (Trevor, 2026-10-20). Always there, so nothing moves; usable once the
	 * symbol is an icon, as an emoji keeps its own colours.
	 */
	const colours = [
		{ value: DEFAULT, label: 'Default' },
		...SYMBOL_COLOURS.map((c) => ({ value: c, label: SYMBOL_COLOUR_LOOKS[c].label }))
	];
	const iconSymbol = $derived(!!look.symbol?.startsWith('ph:'));
</script>

<Select
	label="Symbol"
	value={look.symbol || NONE}
	options={symbols}
	onChange={(v) => onSymbol(v === NONE ? '' : v)}
>
	{#snippet item(option)}{@render choice(option)}{/snippet}
	{#snippet selected(option)}{@render choice(option)}{/snippet}
</Select>

<Select
	label="Symbol colour"
	value={look.symbolColour ?? DEFAULT}
	options={colours}
	onChange={(v) => onColour(v === DEFAULT ? undefined : (v as SymbolColour))}
	disabled={!iconSymbol}
>
	{#snippet item(option)}{@render swatch(option)}{/snippet}
	{#snippet selected(option)}{@render swatch(option)}{/snippet}
</Select>

<!-- Per token (Trevor, 2026-10-23); like the colour, usable once the symbol is an icon. -->
<Toggle
	label="Filled symbol"
	checked={!!look.symbolFill}
	onChange={onFill}
	disabled={!iconSymbol}
/>

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
