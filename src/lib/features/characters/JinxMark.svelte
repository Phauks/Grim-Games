<script lang="ts">
	import type { Character, CharacterId, Jinx } from '#lib/core/data/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { iconFallback } from '#lib/ui/token/icon-fallback.ts';
	import { officialData } from './game-data.svelte.ts';
	import { fallbackIconUrl, iconUrl } from './icon-url.ts';
	import JinxNote from './JinxNote.svelte';

	/**
	 * A character's jinxes as a mark on its name band (CharacterRow's `afterName`): one tap
	 * target holding the icons of the characters it is jinxed with, which opens the jinxes
	 * (JinxNote) in a dialog, so nothing in the row moves (Trevor approved, 2026-10-16). The
	 * script sheet and the day's character rows (L107) both show it.
	 */
	interface Props {
		characterId: CharacterId;
		/** The jinxes to show, each involving `characterId`. */
		jinxes: readonly Jinx[];
		/** The script's characters, for homebrew names and icons; else TPI's. */
		characters?: ReadonlyMap<CharacterId, Character>;
	}

	let { characterId, jinxes, characters }: Props = $props();

	const lookup = (id: CharacterId) => characters?.get(id) ?? officialData.current?.byId.get(id);
	const partners = $derived(
		jinxes
			.map((j) => lookup(j.characters[0] === characterId ? j.characters[1] : j.characters[0]))
			.filter((c) => !!c)
	);
	// The dialog is made on first tap: a script sheet can hold many marks.
	let used = $state(false);
	let open = $state(false);
</script>

<button
	type="button"
	class="jinx-mark"
	data-testid="jinx-mark"
	aria-haspopup="dialog"
	aria-label={t('player.jinxedWith', { names: partners.map((p) => p.name).join(', ') })}
	onclick={() => {
		used = true;
		open = true;
	}}
>
	{#each partners as p (p.id)}
		{@const src = iconUrl(p)}
		{#if src}<img
				{src}
				alt=""
				referrerpolicy="no-referrer"
				{@attach iconFallback(fallbackIconUrl(p))}
			/>{:else}<span class="dot"></span>{/if}
	{/each}
</button>

{#if used}
	<Dialog bind:open title={t('player.jinxes')}>
		<ul class="jinx-list">
			{#each jinxes as jinx (jinx.characters.join('+'))}
				<li><JinxNote {jinx} {characters} /></li>
			{/each}
		</ul>
	</Dialog>
{/if}

<style>
	/* In the band the icons keep a 44px tap area without making the band taller. */
	.jinx-mark {
		position: relative;
		display: inline-flex;
		flex: 0 4 auto;
		align-items: center;
		gap: calc(0.125 * var(--u));
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		touch-action: manipulation;
		/* Many partners (a script with every character) end at the band's end, never past it. */
		overflow-x: clip;
	}
	.jinx-mark::before {
		content: '';
		position: absolute;
		inset: calc((1.6em - var(--tap-target)) / 2) 0;
	}
	.jinx-mark img,
	.jinx-mark .dot {
		width: 1.3em;
		height: 1.3em;
		border-radius: 50%;
		background: var(--token-face);
	}
	.jinx-list {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* A faint line under each jinx, as in the Reference's lists (Trevor, 2026-10-18). */
	.jinx-list li {
		padding-bottom: var(--space-2);
		border-bottom: var(--card-border);
	}
</style>
