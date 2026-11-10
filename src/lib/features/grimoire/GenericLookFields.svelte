<script lang="ts">
	import { onDestroy } from 'svelte';
	import {
		REMINDER_NUMBER_MAX,
		REMINDER_NUMBER_MIN,
		SYMBOL_COLOURS,
		isNumberSymbol,
		numberSymbol,
		symbolNumber,
		type GenericLook,
		type SymbolColour
	} from '#lib/core/model/index.ts';
	import type { CounterTime } from '#lib/core/data/counter-rules.ts';
	import { SYMBOL_COLOUR_LOOKS } from './symbol-colour.ts';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import { named, TILE_EMOJI, TILE_SYMBOLS } from '#lib/features/setup/tile-face.ts';
	import TileMarkFace from '#lib/features/setup/TileMarkFace.svelte';

	/**
	 * A generic ∞ token's text, symbol, symbol colour and fill, for a placed reminder
	 * (ReminderNoteField) and for the ∞ tokens of the bank and a player's tray
	 * (GenericLookDialog). The text comes first (Trevor, 2026-11-10: fewer steps to add details):
	 * Enter saves it, and so does closing; emptied, the token goes back to a plain ∞. The symbol
	 * (Trevor, 2026-10-19: chosen per token) is nothing, one of the bag tiles' symbols, or one of
	 * their emoji, every one shown at once in a grid that scrolls on its own, and the colours are
	 * swatches (Trevor, 2026-11-10: "access to symbols and stuff"). A number token (plan M35,
	 * Trevor 2026-11-03) has its Number instead of a symbol.
	 */
	interface Props {
		look: GenericLook;
		onNote: (note: string) => void;
		/** Blank clears it. */
		onSymbol: (symbol: string) => void;
		/** None is the reminder's own ink. */
		onColour: (colour: SymbolColour | undefined) => void;
		onFill: (fill: boolean) => void;
		/**
		 * A number token's Counts up (plan M53, Trevor 2026-11-04): up by one each night (at
		 * dusk) or day (at dawn); none stays put. Left out, the row isn't offered.
		 */
		onCountsUp?: (countsUp: CounterTime | undefined) => void;
		/** Enter in the text, after it is saved (GenericLookDialog: Confirm). */
		onEnter?: () => void;
		/** The text as typed, before it is saved (a live preview shows it). */
		text?: string;
	}

	let {
		look,
		onNote,
		onSymbol,
		onColour,
		onFill,
		onCountsUp,
		onEnter,
		text = $bindable('')
	}: Props = $props();
	// Only when the saved text changes: picking a symbol mid-typing keeps what was typed.
	const saved = $derived(look.note ?? '');
	$effect.pre(() => {
		text = saved;
	});

	function save() {
		const note = text.trim();
		if (note !== (look.note ?? '')) onNote(note);
	}
	onDestroy(save);

	// A radio needs a value of its own for None and Default.
	const NONE = 'none';
	const DEFAULT = 'default';
	const symbols = [
		{ value: NONE, label: 'None' },
		...TILE_SYMBOLS.map(({ icon, key }) => ({ value: icon, label: named(key) })),
		...TILE_EMOJI.map(({ emoji, key }) => ({ value: emoji, label: named(key) }))
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
	const NEVER = 'never';
	const countsUpOptions = [
		{ value: NEVER, label: 'Never' },
		{ value: 'dusk', label: 'Each night' },
		{ value: 'dawn', label: 'Each day' }
	];
	const number = $derived(isNumberSymbol(look.symbol) ? symbolNumber(look.symbol) : undefined);
</script>

<TextField
	label="Text"
	bind:value={text}
	maxlength={60}
	enterkeyhint="done"
	oncommit={() => {
		save();
		onEnter?.();
	}}
	testid="reminder-note"
/>

{#if number !== undefined}
	<NumberSelect
		label="Number"
		value={number}
		min={REMINDER_NUMBER_MIN}
		max={REMINDER_NUMBER_MAX}
		onchange={(n) => onSymbol(numberSymbol(n))}
		testid="reminder-number"
	/>
	{#if onCountsUp}
		<Select
			label="Counts up"
			value={look.countsUp ?? NEVER}
			options={countsUpOptions}
			onChange={(v) => onCountsUp(v === NEVER ? undefined : (v as CounterTime))}
		/>
	{/if}
{:else}
	<!-- Every symbol at once, in a box that scrolls on its own (no reflow). -->
	<div class="symbols" data-testid="symbol-choices">
		<ChoiceGroup
			label="Symbol"
			layout="row"
			value={look.symbol || NONE}
			options={symbols}
			onChange={(v) => onSymbol(v === NONE ? '' : v)}
		>
			{#snippet item(option)}{@render choice(option)}{/snippet}
		</ChoiceGroup>
	</div>
{/if}

<ChoiceGroup
	label={number !== undefined ? 'Colour' : 'Symbol colour'}
	layout="row"
	value={look.symbolColour ?? DEFAULT}
	options={colours}
	onChange={(v) => onColour(v === DEFAULT ? undefined : (v as SymbolColour))}
	disabled={!iconSymbol && number === undefined}
>
	{#snippet item(option)}{@render swatch(option)}{/snippet}
</ChoiceGroup>

<!-- Per token (Trevor, 2026-10-23); like the colour, usable once the symbol is an icon. A
	 number is never drawn filled. -->
{#if number === undefined}
	<Toggle
		label="Filled symbol"
		checked={!!look.symbolFill}
		onChange={onFill}
		disabled={!iconSymbol}
	/>
{/if}

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
	<span class="face" title={option.label}
		>{#if option.value.startsWith('ph:')}<TileMarkFace
				mark={{ kind: 'symbol', icon: option.value, name: option.label }}
			/>{:else if option.value !== NONE}<TileMarkFace
				mark={{ kind: 'emoji', emoji: option.value, name: option.label }}
			/>{:else}{option.label}{/if}{#if option.value !== NONE}<span class="visually-hidden"
				>{option.label}</span
			>{/if}</span
	>
{/snippet}

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
	.face {
		display: inline-grid;
		place-items: center;
		min-width: 1.5em;
	}
	.face :global(.mark) {
		font-size: 0.75em;
	}
	/* About three rows of symbols in view under their label; the rest scroll inside. */
	.symbols :global(.options) {
		max-height: calc(3.6 * var(--tap-target));
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: calc(0.25 * var(--u));
	}
</style>
