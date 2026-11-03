<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import type {
		Alignment,
		Character,
		CharacterId,
		CharacterName,
		PlayerName
	} from '#lib/core/data/index.ts';
	import CharacterRow from './CharacterRow.svelte';
	import CharacterBadge from './CharacterBadge.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { loadOfficialData, officialData } from './game-data.svelte.ts';
	import { contextCharacters } from './character-context.ts';
	import { resolveTemplate, type CharacterTemplateName } from './character-templates.ts';
	import { fallbackIconUrl, iconUrl } from './icon-url.ts';
	import { iconFallback } from '#lib/ui/token/icon-fallback.ts';

	/**
	 * A character, the one way the app draws one with its name (Trevor, 2026-11-02: one
	 * component, parts turned on or off, each call site naming a template). `template` sets
	 * the defaults (character-templates.ts); every part below can still be set by the call
	 * site. The ring templates take the script's look, the pill ones sit in a line of text.
	 */
	interface Props {
		template?: CharacterTemplateName;
		/** The character itself; otherwise looked up from `characterId`. */
		character?: Character;
		characterId?: CharacterId;
		/** Its alignment when it isn't the type's own (a seat's evil Townsfolk). */
		alignment?: Alignment;
		/** The seat's player, the second half of the character's piece. */
		playerName?: PlayerName;
		/** Overrides the template's ability (a ring, or an entry's body). */
		ability?: boolean;
		/** The ability as the host draws it (rules terms underlined). */
		abilityText?: Snippet;
		/** Overrides the template's width. */
		fullWidth?: boolean;
		/** The words as written ("Village Idiots"; pill only). */
		text?: CharacterName;
		/** The ring opens the character's page (ring only). */
		info?: boolean | ((character: Character) => void);
		/** A pill inside another button is drawn, not a button of its own. */
		interactive?: boolean;
		/** One half of a jinx's joined pair (pill only). */
		joined?: 'start' | 'end';
		/** Tags right after the name, on the band (Custom, off-script, bluff). */
		tags?: Snippet;
		/** Marks at the band's end (jinx partners). */
		marks?: Snippet;
		/** Controls: under the band's end on a ring, after the pill on an entry. */
		controls?: Snippet;
		/** The host's data on the band's line, outside the band (a night step's count). */
		aside?: Snippet;
		/** Text under it: inside the row on a ring, indented under the pill on an entry. */
		children?: Snippet;
		/** An entry's lower strip, joined under its text. */
		footer?: Snippet;
		note?: string;
		withNote?: boolean;
		withCheck?: boolean;
		checked?: boolean;
		pressed?: boolean;
		current?: boolean;
		disabled?: boolean;
		dashed?: boolean;
		label?: string;
		describedby?: string;
		hidden?: Snippet;
		onclick?: () => void;
	}

	let {
		template = 'row',
		character: given,
		characterId,
		alignment,
		playerName,
		ability,
		abilityText,
		fullWidth,
		text,
		info,
		interactive,
		joined,
		tags,
		marks,
		controls,
		aside,
		children,
		footer,
		note,
		withNote,
		withCheck,
		checked,
		pressed,
		current,
		disabled,
		dashed,
		label,
		describedby,
		hidden,
		onclick
	}: Props = $props();

	const look = $derived(resolveTemplate(template, { ability, fullWidth }));

	onMount(() => void loadOfficialData());
	const gameCharacters = contextCharacters();
	const id = $derived(given?.id ?? characterId);
	const character = $derived(
		given ?? (id ? (gameCharacters?.()?.get(id) ?? officialData.current?.byId.get(id)) : undefined)
	);
</script>

{#if look.shape === 'icon'}
	<!-- The icon alone, named for the character; `label=""` when the host names it already. -->
	{#if character}{@const src = iconUrl(character, alignment)}{#if src}<img
				class="icon"
				{src}
				alt={label ?? character.name}
				data-character={character.id}
				referrerpolicy="no-referrer"
				draggable="false"
				{@attach iconFallback(fallbackIconUrl(character))}
			/>{:else}<span class="icon dot" data-character={character.id}></span>{/if}{/if}
{:else if look.shape === 'ring'}
	{#if character}<CharacterRow
			{character}
			{alignment}
			{playerName}
			ability={abilityText}
			showAbility={look.ability}
			fullWidth={look.fullWidth}
			{info}
			{note}
			{withNote}
			{withCheck}
			{checked}
			{pressed}
			{current}
			{disabled}
			{dashed}
			{label}
			{describedby}
			afterName={tags}
			{marks}
			{hidden}
			end={controls}
			{aside}
			{children}
			{onclick}
		/>{/if}
{:else if look.entry}
	<!--
		An entry: the badge with its player as a bar across its space, the text indented under
		it, laid out like a jinx (Trevor, 2026-10-16/17); with a footer it is a card with a
		joined lower strip (Trevor, 2026-10-23). Trevor (2026-11-02) folded the old entry into
		the badge with player: the same badge, only wider. Without a character the bar is the
		player alone, or `label`.
	-->
	<div class="entry" data-card={footer ? '' : undefined}>
		<span class="bar"
			>{#if id}<CharacterBadge
					characterId={id}
					character={given}
					{alignment}
					{playerName}
				/>{:else if playerName}<PlayerBadge name={playerName} />{:else}<span class="plain"
					>{label}</span
				>{/if}{#if controls}{@render controls()}{/if}</span
		>
		<div class="body">
			{#if look.ability && character}<p class="ability" data-testid="ability">
					{#if abilityText}{@render abilityText()}{:else}{character.ability}{/if}
				</p>{/if}
			{#if children}{@render children()}{/if}
		</div>
		{#if footer}<div class="footer">{@render footer()}</div>{/if}
	</div>
{:else if id && !tags && !marks && !look.fullWidth}
	<CharacterBadge
		characterId={id}
		character={given}
		{alignment}
		{playerName}
		{text}
		{interactive}
		{joined}
	/>
{:else if id}
	<span class="pill" data-full={look.fullWidth ? '' : undefined}
		><CharacterBadge
			characterId={id}
			character={given}
			{alignment}
			{playerName}
			{text}
			{interactive}
			{joined}
		/>{#if tags}{@render tags()}{/if}{#if marks}{@render marks()}{/if}</span
	>
{/if}

<style>
	/* Fills the box its host gives it (or --character-icon-size), round on the token's face. */
	.icon {
		display: block;
		width: var(--character-icon-size, 100%);
		height: var(--character-icon-size, 100%);
		border-radius: 50%;
		object-fit: contain;
	}
	.dot {
		background: var(--token-face);
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		max-width: 100%;
		vertical-align: middle;
	}
	.pill[data-full] {
		display: flex;
		width: 100%;
	}
	.pill[data-full] > :global(.badge) {
		flex: 1 1 auto;
		min-width: 0;
	}

	.entry {
		padding: var(--space-2) 0;
		border-bottom: var(--card-border);
	}
	/* The controls wrap under the badge only when the line is too narrow (largest text). */
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		margin-bottom: var(--space-1);
	}
	.bar :global(.badge) {
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
	}
	.bar > :global(:not(.badge)) {
		flex: none;
	}
	.plain {
		display: block;
		padding: 0 var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-full);
		font-family: var(--font-player);
	}
	.body {
		padding-inline-start: var(--space-3);
	}
	.ability {
		margin: 0;
		font-family: var(--font-ability);
	}
	/*
	 * A card: the footer a raised strip joined to its bottom. Its list draws the box and the
	 * dividers (Trevor, 2026-10-23: L44, rows with dividers, not boxes with gaps).
	 */
	.entry[data-card] {
		padding: var(--space-2) var(--space-2) 0;
		border-bottom: 0;
	}
	.entry[data-card] .body {
		padding-inline: var(--space-2);
		padding-bottom: var(--space-2);
	}
	/* Its end (the day's button) runs the strip's full height to its right edge (Trevor, 2026-10-24). */
	.footer {
		display: flex;
		align-items: stretch;
		gap: var(--space-2);
		min-height: var(--tap-target);
		margin-inline: calc(-1 * var(--space-2));
		padding: 0 0 0 var(--space-3);
		border-top: var(--card-border);
		/* A see-through tint of the text (the hover tint), so the list's edge still shows. */
		background: var(--surface-hover);
	}
</style>
