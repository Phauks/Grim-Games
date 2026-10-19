<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { defaultAlignment, type Character } from '#lib/core/data/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import CharacterDialog from '#lib/features/characters/CharacterDialog.svelte';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import { prefetchWikiPage } from '#lib/features/characters/wiki-page.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Props {
		character: Character;
		copies: number;
		/** Whether more than one copy may be added (Village Idiot, Legion, or the switch). */
		duplicates: boolean;
		/** The other selected characters it is jinxed with, shown by their icons (Trevor, 2026-10-19). */
		jinxedWith?: readonly Character[];
		/** In play though not on the script: marked, still under its own type. */
		offScript?: boolean;
		/** One of the Demon's bluffs (Trevor, 2026-10-18): tagged, not chosen for the bag. */
		bluff?: boolean;
		/** Kept by Random (Trevor, 2026-10-19). */
		locked?: boolean;
		/** Locks or unlocks it; without it there is no lock (Fabled and Loric). */
		onLock?: () => void;
		onToggle: () => void;
		onAddCopy: () => void;
	}

	let {
		character,
		copies,
		duplicates,
		jinxedWith = [],
		offScript = false,
		bluff = false,
		locked = false,
		onLock,
		onToggle,
		onAddCopy
	}: Props = $props();
	const selected = $derived(copies > 0);
	const uid = $props.id();
	// The character's page opens from its icon (Trevor, 2026-10-18); made on first use.
	let infoUsed = $state(false);
	let infoOpen = $state(false);
</script>

<!--
	One selectable character. Tapping its icon opens its character page; tapping the rest
	toggles it (or removes one copy when there are several); the + button adds a copy. Every mark has a fixed slot, so selecting never moves anything.
-->
<div
	class="choice"
	data-selected={selected ? '' : undefined}
	data-off-script={offScript ? '' : undefined}
	data-type={character.type}
>
	<button
		type="button"
		class="info"
		aria-haspopup="dialog"
		aria-label={t('setup.characterInfo', { name: character.name })}
		onpointerdown={() => prefetchWikiPage(character)}
		onclick={() => {
			infoUsed = true;
			infoOpen = true;
		}}
	>
		<CharacterToken {character} alignment={defaultAlignment(character.type)} size={44} />
	</button>
	<button
		type="button"
		class="main"
		aria-pressed={selected}
		aria-label={copies > 1 ? `${character.name}, ${copies} copies` : character.name}
		aria-describedby={bluff ? `${uid}-bluff` : undefined}
		data-character-id={character.id}
		onclick={onToggle}
	>
		{#if bluff}<span id="{uid}-bluff" class="visually-hidden"
				>{selected ? t('setup.bluffInPlay') : t('setup.bluff')}</span
			>{/if}
		<span class="text">
			<span class="title">
				<!-- eslint-disable-next-line grim/names-as-badges -- caption beside its own token; a badge would repeat the icon -->
				<span class="name">{character.name}</span>
				{#if offScript}<span class="tag">{t('setup.offScript')}</span>{/if}
			</span>
			<span class="ability">{character.ability}</span>
		</span>
		<span class="marks" aria-hidden="true">
			<span
				class="jinx"
				data-testid="jinx-partners"
				title={jinxedWith.length
					? t('setup.jinxedWith', { names: jinxedWith.map((p) => p.name).join(', ') })
					: undefined}
				>{#each jinxedWith as p (p.id)}{@const src = iconUrl(
						p,
						defaultAlignment(p.type)
					)}{#if src}<img {src} alt="" data-partner={p.id} />{:else}<span
							class="dot"
							data-partner={p.id}
						></span>{/if}{/each}</span
			>
			<span class="copies">{copies > 1 ? `×${copies}` : ''}</span>
			<!--
				A Demon bluff shows a red badge where the check goes (Trevor, 2026-10-18); one also
				chosen for the bag adds a warning, not a lock.
			-->
			<span class="check"
				>{#if bluff}<span class="bluff" data-testid="bluff-tag"
						>{#if selected}<Icon name="warning" />{/if}{t('setup.bluffShort')}</span
					>{:else if selected}<Icon name="check" />{/if}</span
			>
		</span>
	</button>
	<!-- Always in place, disabled until selected, so selecting moves nothing. -->
	{#if onLock}
		<button
			type="button"
			class="lock"
			aria-pressed={selected && locked}
			aria-label={t('setup.lockFor', { name: character.name })}
			title={t('setup.lockFor', { name: character.name })}
			disabled={!selected}
			data-testid="lock-character"
			onclick={onLock}><Icon name="lock" /></button
		>
	{/if}
	{#if duplicates}
		<button
			type="button"
			class="add"
			aria-label={t('setup.addAnotherOf', { name: character.name })}
			title={t('setup.addAnother')}
			onclick={onAddCopy}><Icon name="add" /></button
		>
	{/if}
</div>
{#if infoUsed}<CharacterDialog
		bind:open={infoOpen}
		{character}
		icon={iconUrl(character, defaultAlignment(character.type))}
	/>{/if}

<style>
	.choice {
		display: flex;
		align-items: stretch;
		border-radius: var(--radius-md);
		background: var(--choice-background);
		color: var(--choice-color);
		box-shadow: inset 0 0 0 1px var(--border);
	}
	/*
	 * Selected looks the same however it was chosen (tap, Random, reload): the ring is drawn
	 * above the row, so a hover or a phone's sticky tap highlight can't paint over it, and it
	 * is not red, which reads as an error (Trevor, 2026-10-16).
	 */
	.choice {
		position: relative;
	}
	/* Not on the script: a dashed edge and a tag beside the name. */
	.choice[data-off-script] {
		box-shadow: none;
		outline: 2px dashed var(--border);
		outline-offset: -2px;
	}
	/* The name, then the off-script tag on the same line when it fits. */
	.title {
		grid-column: 1;
		grid-row: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 var(--space-2);
		min-width: 0;
	}
	.tag {
		padding: 0 0.4em;
		border-radius: var(--radius-full);
		background: var(--surface);
		color: var(--on-surface-muted);
		font-family: var(--font-control);
		font-size: 0.7rem;
		font-weight: 600;
		vertical-align: middle;
	}
	.bluff {
		display: inline-flex;
		align-items: center;
		gap: 0.2em;
		padding: 0 0.4em;
		border-radius: var(--radius-full);
		background: var(--evil);
		color: var(--on-evil);
		font-family: var(--font-control);
		font-size: 0.7rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.choice[data-selected] {
		background: var(--choice-selected-background);
	}
	.choice[data-selected]::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: inset 0 0 0 2px var(--focus);
		pointer-events: none;
	}
	/*
	 * Token | name | marks on the first line; the ability runs under the name and the marks,
	 * so the marks' reserved slot doesn't narrow the ability text (Trevor: it broke early).
	 */
	.main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		flex: 1;
		align-items: start;
		column-gap: var(--space-2);
		min-width: 0;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
		touch-action: manipulation;
	}
	@media (hover: hover) {
		.main:hover {
			background: var(--surface-selected);
			border-radius: var(--radius-md);
		}
	}
	/* The icon is its own tap target: the character's page, never a toggle. */
	.info {
		display: grid;
		place-items: start center;
		flex: none;
		min-width: var(--tap-target);
		padding: var(--space-1) 0 var(--space-1) var(--space-2);
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		cursor: pointer;
		touch-action: manipulation;
	}
	@media (hover: hover) {
		.info:hover {
			background: var(--surface-selected);
		}
	}
	.text {
		display: contents;
	}
	.name {
		min-width: 0;
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
		overflow-wrap: anywhere;
	}
	.ability {
		grid-column: 1 / 3;
		grid-row: 2;
		font-family: var(--font-ability);
		font-size: 0.8rem;
		line-height: 1.3;
		opacity: 0.9;
	}
	.marks {
		grid-column: 2;
		grid-row: 1;
		display: grid;
		grid-template-columns: 2em 2em minmax(1.25em, auto);
		align-items: center;
		justify-items: center;
		flex: none;
		font-weight: 700;
	}
	/* A fixed slot: a second partner overlaps the first, so nothing beside it moves. */
	.jinx {
		display: flex;
		justify-content: center;
		width: 2em;
	}
	.jinx img,
	.jinx .dot {
		flex: none;
		width: 1.4em;
		height: 1.4em;
		border-radius: 50%;
		background: var(--token-face);
	}
	.jinx > * + * {
		margin-inline-start: -0.8em;
	}
	.add {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--tap-target);
		border: 0;
		border-inline-start: 1px solid var(--border);
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.add:hover {
		background: var(--surface-selected);
	}
	.lock {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--tap-target);
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		cursor: pointer;
		opacity: 0.45;
		touch-action: manipulation;
	}
	.lock[aria-pressed='true'] {
		color: var(--focus);
		opacity: 1;
	}
	.lock:disabled {
		opacity: 0.15;
		cursor: default;
	}
	@media (hover: hover) {
		.lock:not(:disabled):hover {
			background: var(--surface-selected);
			opacity: 1;
		}
	}
</style>
