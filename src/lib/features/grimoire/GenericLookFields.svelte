<script lang="ts">
	import { onDestroy, untrack, type Snippet } from 'svelte';
	import {
		REMINDER_NUMBER_MAX,
		REMINDER_NUMBER_MIN,
		SYMBOL_COLOURS,
		characterSymbol,
		isPresetColour,
		isSymbolColour,
		isNumberSymbol,
		numberSymbol,
		symbolCharacter,
		symbolNumber,
		type GenericLook,
		type SymbolColour,
		type SymbolColourPreset
	} from '#lib/core/model/index.ts';
	import type { Character, CharacterId, Script } from '#lib/core/data/index.ts';
	import type { CounterTime } from '#lib/core/data/counter-rules.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { SYMBOL_COLOUR_LOOKS } from './symbol-colour.ts';
	import CharacterPicker from './CharacterPicker.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import { named, TILE_EMOJI, TILE_SYMBOLS } from '#lib/features/setup/tile-face.ts';
	import TileMarkFace from '#lib/features/setup/TileMarkFace.svelte';

	/**
	 * A generic ∞ token's text, symbol, symbol colour and fill, for a placed reminder
	 * (ReminderNoteField) and for the ∞ tokens of the bank and a player's tray
	 * (GenericLookDialog). Everything fits one phone screen with the keyboard up (Trevor,
	 * 2026-11-10, option B "Tabs"): the text beside a small preview (`lead`), then the symbol
	 * in three tabs of one height (Symbols, Emoji and Characters, a character's icon from the
	 * script or, through the picker, off it), then the colour (presets or any colour picked)
	 * and the fill. Nothing has a None: a tap on the chosen symbol or colour clears it (Trevor,
	 * 2026-11-10). A number token (plan M35) has its Number instead of a symbol.
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
		/** Beside the text: the token as it will look (GenericLookDialog). */
		lead?: Snippet;
		/** The script's characters, in script order: the Characters tab's icons. */
		scriptCharacters?: readonly Character[];
	}

	let {
		look,
		onNote,
		onSymbol,
		onColour,
		onFill,
		onCountsUp,
		onEnter,
		text = $bindable(''),
		lead,
		scriptCharacters = []
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

	const symbols = TILE_SYMBOLS.map(({ icon, key }) => ({ value: icon, label: named(key) }));
	const emoji = TILE_EMOJI.map(({ emoji, key }) => ({ value: emoji, label: named(key) }));
	const scriptIcons = $derived(
		scriptCharacters.map((c) => ({ value: characterSymbol(c.id), label: c.name }))
	);

	const symbol = $derived(look.symbol ?? '');
	const iconCharacterId = $derived(symbolCharacter(symbol));
	// Every official character, with the script's own (homebrew) over them, for the picker.
	const lookup = $derived(
		new Map<CharacterId, Character>([
			...(officialData.current?.byId ?? []),
			...scriptCharacters.map((c) => [c.id, c] as const)
		])
	);
	const script: Script = $derived({
		entries: scriptCharacters.map((c) => ({ kind: 'official' as const, id: c.id }))
	});
	const iconCharacter = $derived(iconCharacterId && lookup.get(iconCharacterId));
	// A character off the script, picked through the picker, shows first in its tab.
	const characterIcons = $derived(
		iconCharacter && !scriptCharacters.some((c) => c.id === iconCharacter.id)
			? [{ value: characterSymbol(iconCharacter.id), label: iconCharacter.name }, ...scriptIcons]
			: scriptIcons
	);
	let picking = $state(false);

	type SymbolTab = 'symbols' | 'emoji' | 'characters';
	const shownTab = (s: string): SymbolTab =>
		symbolCharacter(s) ? 'characters' : s && !s.startsWith('ph:') ? 'emoji' : 'symbols';
	// Opens on the tab of the symbol it has.
	let tab = $state<SymbolTab>(untrack(() => shownTab(look.symbol ?? '')));

	const colours = SYMBOL_COLOURS.map((c) => ({ value: c, label: SYMBOL_COLOUR_LOOKS[c].label }));
	const iconSymbol = $derived(symbol.startsWith('ph:'));
	const number = $derived(isNumberSymbol(look.symbol) ? symbolNumber(look.symbol) : undefined);
	// Only an icon or a number takes a colour: an emoji and a character's icon keep their own.
	const colourable = $derived(iconSymbol || number !== undefined);
	const colour = $derived(look.symbolColour);
	const custom = $derived(colour !== undefined && !isPresetColour(colour) ? colour : undefined);
	const NEVER = 'never';
	const countsUpOptions = [
		{ value: NEVER, label: 'Never' },
		{ value: 'dusk', label: 'Each night' },
		{ value: 'dawn', label: 'Each day' }
	];

	/** The picked colour: a tap while it is chosen clears it, as a preset's does. */
	function customTap(event: MouseEvent) {
		if (custom === undefined) return;
		event.preventDefault();
		onColour(undefined);
	}
</script>

<div class="top">
	{@render lead?.()}
	<div class="text">
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
	</div>
</div>

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
	<!-- Three tabs of one height, each scrolling on its own (no reflow). -->
	<div class="symbols" data-testid="symbol-choices">
		<Tabs
			bind:value={tab}
			steady
			label="Symbol"
			tabs={[
				{ value: 'symbols', label: 'Symbols' },
				{ value: 'emoji', label: 'Emoji' },
				{ value: 'characters', label: 'Characters' }
			]}
		>
			{#snippet panel(v)}
				<div class="grid">
					<!-- First, so it is in view without scrolling the icons. -->
					{#if v === 'characters'}
						<IconButton
							icon="search"
							label="More characters"
							outlined
							onclick={() => (picking = true)}
						/>
					{/if}
					<ChoiceGroup
						label={v === 'symbols' ? 'Symbols' : v === 'emoji' ? 'Emoji' : 'Characters'}
						hideLabel
						layout="row"
						clearable
						value={symbol}
						options={v === 'symbols' ? symbols : v === 'emoji' ? emoji : characterIcons}
						onChange={onSymbol}
					>
						{#snippet item(option)}{@render choice(option)}{/snippet}
					</ChoiceGroup>
				</div>
			{/snippet}
		</Tabs>
	</div>
{/if}

<div class="colours">
	<ChoiceGroup
		label={number !== undefined ? 'Colour' : 'Symbol colour'}
		layout="row"
		clearable
		value={colour !== undefined && isPresetColour(colour) ? colour : ''}
		options={colours}
		onChange={(v) => onColour(v ? (v as SymbolColour) : undefined)}
		disabled={!colourable}
	>
		{#snippet item(option)}{@render swatch(option)}{/snippet}
	</ChoiceGroup>
	<!-- Any colour (Trevor, 2026-11-10: "at least option for full custom"), in the browser's
		 own colour picker, as Settings' colours are (SettingColor). -->
	<label
		class="custom"
		data-chosen={custom !== undefined || undefined}
		data-disabled={!colourable || undefined}
		title="Custom colour"
	>
		<span class="visually-hidden">Custom colour</span>
		<span class="swatch wheel" style:background={custom}></span>
		<input
			type="color"
			value={custom}
			disabled={!colourable}
			onclick={customTap}
			oninput={(event) => {
				const picked = event.currentTarget.value.toLowerCase();
				if (isSymbolColour(picked)) onColour(picked);
			}}
			data-testid="custom-colour"
		/>
	</label>
</div>

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

<CharacterPicker
	bind:open={picking}
	title="Character icon"
	characters={lookup}
	{script}
	types={['townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled', 'loric']}
	current={iconCharacterId}
	onPick={(id) => {
		onSymbol(characterSymbol(id));
		picking = false;
	}}
/>

{#snippet swatch(option: { value: string; label: string })}
	<span
		class="swatch"
		style:background={SYMBOL_COLOUR_LOOKS[option.value as SymbolColourPreset].colour}
		><span class="visually-hidden">{option.label}</span></span
	>
{/snippet}

{#snippet choice(option: { value: string; label: string })}
	{@const character = symbolCharacter(option.value)}
	<span class="face" title={option.label}
		>{#if character && lookup.get(character)}<CharacterToken
				character={lookup.get(character)!}
				size={30}
			/>{:else if option.value.startsWith('ph:')}<TileMarkFace
				mark={{ kind: 'symbol', icon: option.value, name: option.label }}
			/>{:else}<TileMarkFace
				mark={{ kind: 'emoji', emoji: option.value, name: option.label }}
			/>{/if}<span class="visually-hidden">{option.label}</span></span
	>
{/snippet}

<style>
	.top {
		display: flex;
		align-items: end;
		gap: var(--space-3);
	}
	.text {
		flex: 1;
		min-width: 0;
	}
	.face {
		display: inline-grid;
		place-items: center;
		min-width: 1.5em;
	}
	.face :global(.mark) {
		font-size: 0.75em;
	}
	/* About two and a half rows in view under the tabs; the rest scroll inside. */
	.grid {
		display: flex;
		flex-wrap: wrap;
		align-content: start;
		gap: var(--space-2);
		max-height: calc(2.6 * var(--tap-target));
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: calc(0.25 * var(--u));
	}
	/* The options and More characters flow as one run of cells. */
	/* Doubled, to win over ChoiceGroup's own row layout. */
	.grid.grid :global([data-scope='radio-group'][data-part='root']),
	.grid.grid :global([data-scope='radio-group'] .options) {
		display: contents;
	}
	.colours {
		display: flex;
		align-items: end;
		gap: var(--space-2);
	}
	.colours :global(.options) {
		flex-wrap: nowrap;
	}
	.swatch {
		display: inline-block;
		width: 1.4em;
		height: 1.4em;
		border: 0.0625rem solid var(--border);
		border-radius: 50%;
		vertical-align: middle;
	}
	/* Every hue until one is picked, then the picked colour. */
	.wheel {
		background: var(--colour-wheel);
	}
	.custom {
		position: relative;
		display: grid;
		place-items: center;
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--choice-background);
		cursor: pointer;
	}
	.custom[data-chosen] {
		border-color: var(--choice-selected-border);
		background: var(--choice-selected-background);
		box-shadow: inset 0 0 0 1px var(--choice-selected-border);
	}
	.custom[data-disabled] {
		opacity: 0.5;
		cursor: default;
	}
	/* The browser's picker opens from the whole cell; its own swatch isn't drawn. */
	.custom input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: inherit;
	}
</style>
