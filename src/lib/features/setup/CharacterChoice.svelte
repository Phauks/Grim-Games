<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { defaultAlignment, type Character } from '#lib/core/data/index.ts';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
	import { fallbackIconUrl, iconUrl } from '#lib/features/characters/icon-url.ts';
	import { iconFallback } from '#lib/ui/token/icon-fallback.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { isBagDisabled } from '#lib/core/rules/bag-characters.ts';

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
		/**
		 * Adds it to the Demon's bluffs or takes it out (Trevor, 2026-10-22). Without it the row
		 * keeps the button's place empty (Travellers), so the rows line up.
		 */
		onBluff?: () => void;
		/** Why the bluff button can't be used now, e.g. "3 bluffs chosen"; undefined when it can. */
		bluffBlocked?: string;
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
		onBluff,
		bluffBlocked,
		onToggle,
		onAddCopy
	}: Props = $props();
	const selected = $derived(copies > 0);
	/** In play, but its own token stays out of the bag (Drunk, Marionette, Lil' Monsta). */
	const outOfBag = $derived(selected && isBagDisabled(character));
	const uid = $props.id();
	/** The lock chooses an unselected character as well as locking it (Trevor, 2026-10-20). */
	function lock() {
		if (!selected) onToggle();
		onLock?.();
	}
	// The accessible name; the row shows the name itself beside its token.
	// eslint-disable-next-line grim/names-as-badges -- accessible name (aria-label) only
	const label = $derived(copies > 1 ? `${character.name}, ${copies} copies` : character.name);
</script>

<!--
	One selectable character, drawn by the shared CharacterRow's ring look, as the script draws
	it (Trevor, 2026-10-28). Tapping its icon opens its
	character page; tapping the rest toggles it (or removes one copy when there are several);
	the + button adds a copy. Every mark has a fixed slot, so selecting never moves anything.
-->
<CharacterRow
	{character}
	info
	pressed={selected}
	dashed={offScript}
	{label}
	describedby={bluff ? `${uid}-bluff` : outOfBag ? `${uid}-out` : undefined}
	onclick={onToggle}
>
	{#snippet hidden()}
		{#if bluff}<span id="{uid}-bluff" class="visually-hidden"
				>{selected ? t('setup.bluffInPlay') : t('setup.bluff')}</span
			>{/if}
		{#if outOfBag}<span id="{uid}-out" class="visually-hidden">{t('setup.notInBagLong')}</span>{/if}
	{/snippet}
	{#snippet afterName()}
		{#if offScript}<span class="tag">{t('setup.offScript')}</span>{/if}
	{/snippet}
	<!-- Jinx partners and copies take room on the band only when there are any, so the name
	     keeps what it can; they sit at the band's end, so the name never moves. -->
	{#snippet marks()}
		{#if jinxedWith.length}<span
				class="jinx"
				data-testid="jinx-partners"
				title={t('setup.jinxedWith', { names: jinxedWith.map((p) => p.name).join(', ') })}
				>{#each jinxedWith as p (p.id)}{@const src = iconUrl(
						p,
						defaultAlignment(p.type)
					)}{#if src}<img
							{src}
							alt=""
							data-partner={p.id}
							referrerpolicy="no-referrer"
							{@attach iconFallback(fallbackIconUrl(p))}
						/>{:else}<span class="dot" data-partner={p.id}></span>{/if}{/each}</span
			>{/if}
		{#if copies > 1}<span class="copies">×{copies}</span>{/if}
		<!--
			A Demon bluff shows a red badge where the check goes (Trevor, 2026-10-18); one also
			chosen for the bag adds a warning, not a lock. The name keeps its line and place:
			at most less of a long name shows.
		-->
		<span class="check"
			>{#if bluff}<span class="bluff" data-testid="bluff-tag"
					>{#if selected}<Icon name="warning" />{/if}{t('setup.bluffShort')}</span
				>{:else if selected}{#if outOfBag}<span class="out" data-testid="not-in-bag"
						>{t('setup.notInBag')}</span
					>{/if}<Icon name="check" />{/if}</span
		>
	{/snippet}
	{#snippet end()}
		<!-- A bluff may also be chosen for the bag: the tag warns, never locks. -->
		{#if onBluff}
			<button
				type="button"
				class="toggle bluff-toggle"
				aria-pressed={bluff}
				aria-label={t('setup.bluffFor', { name: character.name })}
				title={bluffBlocked || t('setup.bluffFor', { name: character.name })}
				disabled={bluffBlocked !== undefined}
				data-testid="bluff-character"
				onclick={onBluff}><Icon name="demon" /></button
			>
		{:else if onLock}
			<span class="toggle-slot" aria-hidden="true"></span>
		{/if}
		<!-- Always in place and usable: on an unselected character it chooses it too. -->
		{#if onLock}
			<button
				type="button"
				class="lock"
				aria-pressed={selected && locked}
				aria-label={t('setup.lockFor', { name: character.name })}
				title={t('setup.lockFor', { name: character.name })}
				data-testid="lock-character"
				onclick={lock}><Icon name="lock" /></button
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
	{/snippet}
</CharacterRow>

<style>
	.tag,
	.bluff,
	.out {
		padding: 0 0.4em;
		border-radius: var(--radius-full);
		font-family: var(--font-control);
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.4;
		white-space: nowrap;
	}
	.tag,
	.out {
		background: var(--surface);
		color: var(--on-surface-muted);
	}
	.bluff {
		display: inline-flex;
		align-items: center;
		gap: 0.2em;
		background: var(--evil);
		color: var(--on-evil);
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
	.copies {
		padding-inline: var(--space-1);
	}
	/*
	 * The check's slot is at least one icon wide; a "Not in bag" or bluff tag widens it to the
	 * left, at the band's end, so only how much of a long name shows can change.
	 */
	.check {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-1);
		min-width: 1.25em;
	}
	.check > :global(svg) {
		width: 1.1em;
		height: 1.1em;
	}
	.lock,
	.toggle,
	.toggle-slot,
	.add {
		display: grid;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		touch-action: manipulation;
		place-items: center;
		width: var(--tap-target);
		cursor: pointer;
	}
	.add {
		border-block-start: 1px solid var(--border);
	}
	/* Small, under the band that runs over them (Trevor, 2026-10-28). */
	.lock,
	.toggle,
	.add {
		--icon-size: 1em;
	}
	.lock,
	.toggle {
		color: var(--on-surface-muted);
		opacity: 0.45;
	}
	.lock[aria-pressed='true'] {
		color: var(--focus);
		opacity: 1;
	}
	.bluff-toggle[aria-pressed='true'] {
		color: var(--evil-text);
		opacity: 1;
	}
	.toggle:disabled {
		opacity: 0.2;
		cursor: default;
	}
	/* The row's hover covers the lock; the lock only brightens (Trevor: one hover). */
	@media (hover: hover) {
		.lock:hover,
		.toggle:hover:not(:disabled) {
			opacity: 1;
		}
	}
</style>
