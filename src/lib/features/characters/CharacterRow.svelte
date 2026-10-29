<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		defaultAlignment,
		type Alignment,
		type Character,
		type PlayerName
	} from '#lib/core/data/index.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import CharacterDialog from './CharacterDialog.svelte';
	import CharacterToken from './CharacterToken.svelte';
	import { fallbackIconUrl, iconUrl } from './icon-url.ts';
	import { iconFallback } from '#lib/ui/token/icon-fallback.ts';
	import { prefetchWikiPage } from './wiki-page.svelte.ts';

	/**
	 * One character as every list shows it: token, name (with an optional note on its line)
	 * and ability. The one row for the picker, character selection and the day's abilities
	 * (Trevor, 2026-10-19/20), so a list of chosen characters looks like the list they were
	 * chosen from. The main part is a button when it has `onclick`, otherwise read-only.
	 *
	 * The whole row is one box with one hover: token, text, marks and `end` controls alike
	 * (Trevor, 2026-10-20). Marks and controls keep fixed places, so choosing never moves the
	 * name or the ability.
	 */
	interface Props {
		character: Character;
		/**
		 * `ring`: the character's icon in a ring of its alignment's colour, a band of that colour
		 * carrying the name out of the ring's top, the ability under the band (Trevor,
		 * 2026-10-28, for every script sheet; the day's characters and character selection
		 * too, so they look like the script). With `onclick` the band and ability are the
		 * button and chosen rows are drawn as the box look draws them; `end` controls follow
		 * the band's end.
		 */
		look?: 'box' | 'ring';
		/** The ability as the host draws it (rules terms underlined); defaults to plain text. */
		ability?: Snippet;
		/** False draws no token. */
		token?: boolean;
		tokenSize?: number;
		/** The token's alignment when it isn't the type's own (a seat's evil Townsfolk). */
		alignment?: Alignment;
		/**
		 * The token is its own button that opens the character's page: `true` opens it here,
		 * a function opens it its own way. It never chooses the character.
		 */
		info?: boolean | ((character: Character) => void);
		/** On the name's line; never adds a line. */
		note?: string;
		/** The seat's player, a PlayerBadge after the name as character badges show it. */
		playerName?: PlayerName;
		/** Keep the note's place even when there is none, so rows line up. */
		withNote?: boolean;
		/** Ends the name's line with the tick (the picker's chosen mark). */
		withCheck?: boolean;
		checked?: boolean;
		/** Multi choice: aria-pressed, drawn as chosen. */
		pressed?: boolean;
		/** Single choice: aria-current, drawn as chosen. */
		current?: boolean;
		disabled?: boolean;
		/** Not on the script: a dashed edge. */
		dashed?: boolean;
		/** Accessible name; defaults to the name and any note. */
		label?: string;
		describedby?: string;
		/** Right after the name, on its line (an off-script tag). */
		afterName?: Snippet;
		/** At the end of the name's line, in a slot the caller keeps a fixed size. */
		marks?: Snippet;
		/** Inside the main button, for visually hidden descriptions. */
		hidden?: Snippet;
		/** Controls at the row's end, full height (a lock, Add another, the day's Used). */
		end?: Snippet;
		/** Under the ability, inside the row (the day's state sentence). */
		children?: Snippet;
		onclick?: () => void;
	}

	let {
		character,
		look = 'box',
		ability,
		token = true,
		tokenSize = 36,
		alignment,
		info,
		note,
		withNote = false,
		playerName,
		withCheck = false,
		checked = false,
		pressed,
		current,
		disabled = false,
		dashed = false,
		label,
		describedby,
		afterName,
		marks,
		hidden,
		end,
		children,
		onclick
	}: Props = $props();

	const tokenAlignment = $derived(alignment ?? defaultAlignment(character.type));
	const chosen = $derived(pressed === true || current === true);
	// The ring and band's colour, as the character's badge has it.
	const team = $derived(tokenAlignment ?? character.type);
	const icon = $derived(iconUrl(character, tokenAlignment));
	/** The ring look's end controls' width: the ability leaves them room under the band. */
	let endWidth = $state(0);
	// The character's page, made on first use.
	let infoUsed = $state(false);
	let infoOpen = $state(false);
	function openInfo() {
		if (typeof info === 'function') return info(character);
		infoUsed = true;
		infoOpen = true;
	}
</script>

{#snippet ringIcon()}
	{#if icon}<img
			src={icon}
			alt=""
			referrerpolicy="no-referrer"
			{@attach iconFallback(fallbackIconUrl(character, tokenAlignment))}
		/>{/if}
{/snippet}

{#snippet content()}
	{#if hidden}{@render hidden()}{/if}
	<span class="head">
		<!-- eslint-disable-next-line grim/names-as-badges -- caption beside its own token; a badge would repeat the icon -->
		<span class="name">{character.name}</span>
		{#if playerName}<span class="player"><PlayerBadge name={playerName} /></span>{/if}
		{#if afterName}{@render afterName()}{/if}
		{#if withNote || note}<span class="note">{note ?? ''}</span>{/if}
	</span>
	{#if marks || withCheck}
		<span class="marks" aria-hidden="true"
			>{#if marks}{@render marks()}{/if}{#if withCheck}<span class="check"
					>{#if checked}<Icon name="check" />{/if}</span
				>{/if}</span
		>
	{/if}
	<span class="ability">{character.ability}</span>
	{#if children}<span class="below">{@render children()}</span>{/if}
{/snippet}

{#snippet ringText()}
	{#if hidden}{@render hidden()}{/if}
	<span class="band">
		<!-- eslint-disable-next-line grim/names-as-badges -- the band is the character's badge; its icon is in the ring -->
		<span class="band-name">{character.name}</span>
		{#if playerName}<span class="player"><PlayerBadge name={playerName} /></span>{/if}
		{#if afterName}{@render afterName()}{/if}
		{#if marks || withCheck}<span class="marks" aria-hidden="true"
				>{#if marks}{@render marks()}{/if}{#if withCheck}<span class="check"
						>{#if checked}<Icon name="check" />{/if}</span
					>{/if}</span
			>{/if}
	</span>
	<span class="ring-ability">
		{#if ability}{@render ability()}{:else}{character.ability}{/if}
	</span>
	{#if children}<span class="ring-below">{@render children()}</span>{/if}
{/snippet}

{#if look === 'ring'}
	<div
		class="ring-row"
		data-team={team}
		data-type={character.type}
		data-character-id={onclick ? undefined : character.id}
		data-chosen={chosen ? '' : undefined}
		data-dashed={dashed ? '' : undefined}
		data-disabled={disabled ? '' : undefined}
		data-interactive={onclick ? '' : undefined}
		style:--ring-end={end ? `${endWidth}px` : undefined}
	>
		{#if info}
			<button
				type="button"
				class="ring info"
				aria-haspopup="dialog"
				aria-label={t('picker.characterInfo', { name: character.name })}
				onpointerdown={() => prefetchWikiPage(character)}
				onclick={openInfo}>{@render ringIcon()}</button
			>
		{:else}
			<span class="ring">{@render ringIcon()}</span>
		{/if}
		{#if onclick}
			<button
				type="button"
				class="main ring-main"
				data-character-id={character.id}
				aria-label={label ?? (note ? `${character.name}, ${note}` : character.name)}
				aria-pressed={pressed}
				aria-current={current ? 'true' : undefined}
				aria-describedby={describedby}
				{disabled}
				{onclick}>{@render ringText()}</button
			>
		{:else}
			<div class="ring-main">{@render ringText()}</div>
		{/if}
		{#if end}<span class="end" bind:offsetWidth={endWidth}>{@render end()}</span>{/if}
	</div>
{:else}
	<div
		class="row"
		data-chosen={chosen ? '' : undefined}
		data-dashed={dashed ? '' : undefined}
		data-disabled={disabled ? '' : undefined}
		data-interactive={onclick ? '' : undefined}
		data-type={character.type}
	>
		{#if token}
			{#if info}
				<button
					type="button"
					class="token info"
					aria-haspopup="dialog"
					aria-label={t('picker.characterInfo', { name: character.name })}
					onpointerdown={() => prefetchWikiPage(character)}
					onclick={openInfo}
				>
					<CharacterToken {character} alignment={tokenAlignment} size={tokenSize} />
				</button>
			{:else}
				<span class="token">
					<CharacterToken {character} alignment={tokenAlignment} size={tokenSize} />
				</span>
			{/if}
		{/if}
		{#if onclick}
			<button
				type="button"
				class="main"
				data-character-id={character.id}
				aria-label={label ?? (note ? `${character.name}, ${note}` : character.name)}
				aria-pressed={pressed}
				aria-current={current ? 'true' : undefined}
				aria-describedby={describedby}
				{disabled}
				{onclick}>{@render content()}</button
			>
		{:else}
			<div class="main" data-character-id={character.id}>{@render content()}</div>
		{/if}
		{#if end}<span class="end">{@render end()}</span>{/if}
	</div>
{/if}
{#if infoUsed}<CharacterDialog
		bind:open={infoOpen}
		{character}
		icon={iconUrl(character, tokenAlignment)}
	/>{/if}

<style>
	.row {
		position: relative;
		display: flex;
		align-items: stretch;
		width: 100%;
		min-height: var(--tap-target);
		border-radius: var(--radius-md);
		background: var(--choice-background);
		color: var(--choice-color);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	/* Every surface's own colours: a sheet sets them to parchment (tokens/components.css). */
	@media (hover: hover) {
		.row[data-interactive]:not([data-disabled]):not([data-chosen]):hover {
			background: var(--surface-selected);
		}
	}
	/*
	 * Chosen looks the same however it was chosen (tap, Random, reload): the ring is drawn
	 * above the row, so a hover or a phone's sticky tap highlight can't paint over it, and it
	 * is not red, which reads as an error (Trevor, 2026-10-16).
	 */
	.row[data-chosen] {
		background: var(--choice-selected-background);
	}
	.row[data-chosen]::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: inset 0 0 0 2px var(--focus);
		pointer-events: none;
	}
	.row[data-dashed] {
		box-shadow: none;
		outline: 2px dashed var(--border);
		outline-offset: -2px;
	}
	.row[data-disabled] {
		opacity: 0.55;
	}
	/* The parts sit on the row's own background: one box, one hover. */
	.row button {
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		touch-action: manipulation;
	}
	.token {
		display: grid;
		place-items: start center;
		flex: none;
		min-width: var(--tap-target);
		padding: var(--space-1) 0 var(--space-1) var(--space-2);
	}
	.info {
		border-radius: var(--radius-md) 0 0 var(--radius-md);
		cursor: pointer;
	}
	/* A read-only row: only the token does anything, so only it lights up (the same hover). */
	@media (hover: hover) {
		.row:not([data-interactive]) .info:hover {
			background: var(--surface-selected);
		}
	}
	/*
	 * Name | marks on the first line; the ability runs under both, so the marks' slot never
	 * narrows the ability text (Trevor: it broke early).
	 */
	.main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-rows: auto auto auto;
		flex: 1;
		align-content: start;
		column-gap: var(--space-2);
		min-width: 0;
		padding: var(--space-1) var(--space-2);
		text-align: start;
	}
	button.main {
		cursor: pointer;
	}
	button.main:disabled {
		cursor: default;
	}
	.head {
		grid-column: 1;
		grid-row: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 var(--space-2);
		min-width: 0;
	}
	.name {
		min-width: 0;
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
		overflow-wrap: anywhere;
	}
	/* The player's badge, as in CharacterBadge; a long name ends in "…" inside it. */
	.player {
		display: inline-flex;
		min-width: 0;
	}
	.note {
		flex: 0 1 auto;
		min-width: 0;
		margin-left: auto;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.2;
		color: var(--accent);
	}
	/*
	 * A slot on the name's line that never makes the line taller: what it holds is centred on
	 * the line and may overhang it (Trevor, 2026-10-20: choosing moved the ability down).
	 */
	.marks {
		grid-column: 2;
		grid-row: 1;
		display: flex;
		align-items: center;
		height: 1lh;
		overflow: visible;
		font-weight: 700;
	}
	.check {
		display: grid;
		place-items: center;
		width: 1.25em;
		height: 1lh;
	}
	.check :global(svg) {
		width: 1.1em;
		height: 1.1em;
	}
	.ability {
		grid-column: 1 / 3;
		grid-row: 2;
		font-family: var(--font-ability);
		font-size: 0.8rem;
		line-height: 1.3;
		opacity: 0.9;
	}
	.below {
		grid-column: 1 / 3;
		grid-row: 3;
		min-width: 0;
	}
	.end {
		display: flex;
		flex: none;
		align-items: stretch;
	}
	/* The last control follows the row's rounded end (Trevor, 2026-10-20). */
	.end > :global(:last-child) {
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
	}
	/*
	 * The ring look: the ring over the start of its text, which holds the band and the
	 * ability beside the ring under the band. The ring is as tall as the name and two lines of
	 * ability; a host may set --character-ring smaller (a printed compact sheet).
	 */
	.ring-row {
		--ring: var(--character-ring, 4.4em);
		position: relative;
		/* The ring's z-index stays inside the row, under a sticky header scrolling over it. */
		isolation: isolate;
		display: grid;
		grid-template-columns: var(--ring) minmax(0, 1fr) auto;
		width: 100%;
		min-height: var(--ring);
	}
	.ring {
		z-index: 1;
		display: grid;
		grid-row: 1;
		grid-column: 1;
		align-self: start;
		place-items: center;
		width: var(--ring);
		height: var(--ring);
		box-sizing: border-box;
		padding: 0;
		border: calc(var(--ring) * 0.07) solid var(--team);
		border-radius: 50%;
		background: var(--token-face);
		color: inherit;
		font: inherit;
		touch-action: manipulation;
	}
	button.ring {
		cursor: pointer;
	}
	.ring img {
		width: 88%;
		height: 88%;
	}
	/*
	 * Runs under the ring, so the band can start at the ring's middle, and over the end
	 * controls, so the band runs the row's full width (Trevor, 2026-10-28).
	 */
	.ring-main {
		display: grid;
		grid-row: 1;
		grid-column: 1 / -1;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto 1fr;
		gap: 0;
		align-content: start;
		min-width: 0;
	}
	button.ring-main {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
		touch-action: manipulation;
	}
	button.ring-main:disabled {
		cursor: default;
	}
	/* From the ring's middle to the text's end, so it leaves the ring's top. */
	.band {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		height: 1.7em;
		margin-left: calc(var(--ring) / 2);
		padding: 0 var(--space-3) 0 calc(var(--ring) / 2 + var(--space-2));
		border-radius: 0 var(--radius-full) var(--radius-full) 0;
		background: var(--team);
		color: var(--on-team);
	}
	.band-name {
		min-width: 0;
		overflow: hidden;
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.band .marks {
		height: auto;
		margin-left: auto;
	}
	/* Always two lines' room, even for a short ability, so every row is the same height
	   (Trevor, 2026-10-28), on screen and in print. */
	.ring-ability {
		display: block;
		min-height: calc(2 * 1.35em);
		padding: var(--space-1) var(--ring-end, 0) 0 calc(var(--ring) + var(--space-2));
		font-family: var(--font-ability);
		line-height: 1.35;
	}
	.ring-below {
		display: block;
		min-width: 0;
		padding-inline: calc(var(--ring) + var(--space-2)) var(--ring-end, 0);
	}
	/*
	 * Chosen, as the box look draws it: a tint and a ring of the focus colour, drawn above the
	 * row so no hover paints over it. Every choosable row keeps the same inset, so choosing
	 * moves nothing.
	 */
	.ring-row[data-interactive] {
		padding: var(--space-1);
		border-radius: var(--radius-md);
	}
	@media (hover: hover) {
		.ring-row[data-interactive]:not([data-disabled]):not([data-chosen]):hover {
			background: var(--surface-selected);
		}
	}
	.ring-row[data-chosen] {
		background: var(--choice-selected-background);
	}
	.ring-row[data-chosen]::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: inset 0 0 0 2px var(--focus);
		pointer-events: none;
	}
	.ring-row[data-dashed] {
		outline: 2px dashed var(--border);
		outline-offset: -2px;
	}
	.ring-row[data-disabled] {
		opacity: 0.55;
	}
	/*
	 * Under the band, beside the ability, one above the other so they take one control's
	 * width from the ability: the band runs over them (Trevor, 2026-10-28).
	 */
	.ring-row > .end {
		z-index: 1;
		flex-direction: column;
		grid-row: 1;
		grid-column: 3;
		margin-top: 1.7em;
	}
	/* They share the ability's height; a third (Duplicate Characters' add) makes the row a
	   little taller rather than letting them overlap. */
	.ring-row > .end > :global(*) {
		flex: 1 1 0;
		min-height: 1.25em;
	}
	.ring-row > .end > :global(:last-child) {
		border-radius: 0 0 var(--radius-md) 0;
	}
	.ring-row[data-team='good'] {
		--team: var(--good);
		--on-team: var(--on-good);
	}
	.ring-row[data-team='evil'] {
		--team: var(--evil);
		--on-team: var(--on-evil);
	}
	/* Half good, half evil, as its badge and token are. */
	.ring-row[data-team='traveller'] {
		--team: var(--good);
		--on-team: var(--on-good);
	}
	.ring-row[data-team='traveller'] .band {
		background: linear-gradient(to right, var(--good) 50%, var(--evil) 50%);
	}
	.ring-row[data-team='traveller'] .ring {
		border-color: var(--good) var(--evil) var(--evil) var(--good);
	}
	.ring-row[data-team='fabled'] {
		--team: var(--fabled);
		--on-team: var(--on-fabled);
	}
	.ring-row[data-team='loric'] {
		--team: var(--loric);
		--on-team: var(--on-loric);
	}
	.ring-row[data-team='neutral'] {
		--team: var(--surface-raised);
		--on-team: var(--on-surface);
	}
</style>
