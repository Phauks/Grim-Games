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
	import { fallbackIconUrl, iconUrl } from './icon-url.ts';
	import { iconFallback } from '#lib/ui/token/icon-fallback.ts';
	import { prefetchWikiPage } from './wiki-page.svelte.ts';

	/**
	 * One character as every list shows it: its icon in a ring of its alignment's colour, a
	 * band of that colour carrying the name out of the ring's top, the ability under the band
	 * (Trevor, 2026-10-28: the script's look, then every list's). The one row for script
	 * sheets, the picker, character selection, the bluffs and the day's abilities, so a list of
	 * chosen characters looks like the list they were chosen from. The band and ability are a
	 * button when it has `onclick`, otherwise read-only.
	 *
	 * A choosable row has one hover: ring, text, marks and `end` controls alike (Trevor,
	 * 2026-10-20). Marks and controls keep fixed places, so choosing never moves the name or
	 * the ability.
	 */
	interface Props {
		character: Character;
		/** The ability as the host draws it (rules terms underlined); defaults to plain text. */
		ability?: Snippet;
		/** The ring's alignment when it isn't the type's own (a seat's evil Townsfolk). */
		alignment?: Alignment;
		/**
		 * The ring is its own button that opens the character's page: `true` opens it here,
		 * a function opens it its own way. It never chooses the character.
		 */
		info?: boolean | ((character: Character) => void);
		/** On the band, at its end; never adds a line. */
		note?: string;
		/** The seat's player, a PlayerBadge after the name as character badges show it. */
		playerName?: PlayerName;
		/** Keep the note's place even when there is none, so rows line up. */
		withNote?: boolean;
		/** Ends the band with the tick (the picker's chosen mark). */
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
		/** Right after the name, on the band (an off-script tag). */
		afterName?: Snippet;
		/** At the band's end. */
		marks?: Snippet;
		/** Inside the main button, for visually hidden descriptions. */
		hidden?: Snippet;
		/** Controls under the band's end, beside the ability (bluff, lock, Add another). */
		end?: Snippet;
		/** Under the ability, inside the row (the day's state sentence). */
		children?: Snippet;
		onclick?: () => void;
	}

	let {
		character,
		ability,
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
	/** The end controls' width: the ability leaves them room under the band. */
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

{#snippet ringText()}
	{#if hidden}{@render hidden()}{/if}
	<span class="band">
		<!-- eslint-disable-next-line grim/names-as-badges -- the band is the character's badge; its icon is in the ring -->
		<span class="band-name">{character.name}</span>
		{#if playerName}<span class="player"><PlayerBadge name={playerName} /></span>{/if}
		{#if afterName}{@render afterName()}{/if}
		{#if withNote || note}<span class="note">{note ?? ''}</span>{/if}
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
{#if infoUsed}<CharacterDialog
		bind:open={infoOpen}
		{character}
		icon={iconUrl(character, tokenAlignment)}
	/>{/if}

<style>
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
	}
	.marks {
		display: flex;
		align-items: center;
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
	.end {
		display: flex;
		flex: none;
		align-items: stretch;
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
	/* After a note the marks follow it at the band's end. */
	.band .note + .marks {
		margin-left: 0;
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
