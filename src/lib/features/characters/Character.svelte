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
	import CharacterEntry from './CharacterEntry.svelte';
	import { loadOfficialData, officialData } from './game-data.svelte.ts';
	import { contextCharacters } from './character-context.ts';
	import { resolveTemplate, type CharacterTemplateName } from './character-templates.ts';

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
		/** Overrides the template's ability (ring only). */
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

{#if look.shape === 'ring'}
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
{:else if id && look.entry}
	<CharacterEntry characterId={id} {alignment} {playerName} end={controls} {footer}
		>{#if children}{@render children()}{/if}</CharacterEntry
	>
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
</style>
