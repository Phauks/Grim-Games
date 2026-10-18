<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import type { ScriptJinx } from '#lib/core/rules/jinxes.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { Snippet } from 'svelte';
	import PlayerCounts from './PlayerCounts.svelte';
	import { groupByType } from './player-script.ts';
	import { playerSettings } from './player-settings.svelte.ts';

	interface Props {
		/** What the sheet lists: the script's characters plus recommended Travellers. */
		characters: readonly Character[];
		jinxes: readonly ScriptJinx[];
		/**
		 * Players at the table, when known (the board): that column of the breakdown starts
		 * highlighted. Without it (/play) the reader's own choice is remembered on the device.
		 */
		players?: number;
		/** Printing: every section shown with a plain heading, none can be closed. */
		flat?: boolean;
		/**
		 * Characters on seats, in a game (the board). Travellers and Jinxes then start closed
		 * while none of theirs is in play, and open when one comes into play (Trevor, 2026-10-18).
		 */
		inPlay?: readonly string[];
	}

	let { characters, jinxes, players, flat = false, inPlay }: Props = $props();
	const playing = $derived(inPlay && new Set(inPlay));
	const noJinxInPlay = $derived(
		!!playing && !jinxes.some((j) => j.characters.every((id) => playing.has(id)))
	);
	const density = $derived(playerSettings.current.density);
	const groups = $derived(groupByType(characters));
	const names = $derived(characters.map((c) => c.name));
	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	// Each character's jinxes, for the small icons beside its name (Trevor approved, 2026-10-16).
	const jinxesOf = $derived.by(() => {
		const byCharacter: Record<string, ScriptJinx[]> = {};
		for (const j of jinxes) for (const id of j.characters) (byCharacter[id] ??= []).push(j);
		return byCharacter;
	});
	const partner = (j: ScriptJinx, id: string) =>
		j.characters[0] === id ? j.characters[1] : j.characters[0];
	let jinxFor = $state<Character>();
	let jinxOpen = $state(false);
	const nameOf = (id: string) => byId.get(id)?.name ?? id;
	const TONES: Partial<Record<Character['type'], 'good' | 'evil'>> = {
		townsfolk: 'good',
		outsider: 'good',
		minion: 'evil',
		demon: 'evil'
	};
</script>

{#snippet row(c: Character)}
	{@const own = jinxesOf[c.id]}
	<li class="character" data-character={c.id}>
		<span class="name">
			<CharacterBadge characterId={c.id} character={c} inline={density !== 'normal'} />
			{#if own}
				{@const partners = own.map((j) => byId.get(partner(j, c.id))).filter((x) => !!x)}
				<button
					type="button"
					class="jinx-mark"
					data-testid="jinx-mark"
					aria-label={t('player.jinxedWith', { names: partners.map((p) => p.name).join(', ') })}
					onclick={() => {
						jinxFor = c;
						jinxOpen = true;
					}}
				>
					{#each partners as p (p.id)}
						{@const src = iconUrl(p)}
						{#if src}<img {src} alt="" />{:else}<span class="dot"></span>{/if}
					{/each}
				</button>
			{/if}
		</span>
		<p class="ability"><GlossaryText text={c.ability} {names} /></p>
	</li>
{/snippet}

{#snippet jinxItem(jinx: ScriptJinx)}
	<li class="jinx">
		<span class="pair">
			<CharacterBadge characterId={jinx.characters[0]} character={byId.get(jinx.characters[0])} />
			<CharacterBadge characterId={jinx.characters[1]} character={byId.get(jinx.characters[1])} />
		</span>
		<p class="ability">
			<GlossaryText
				text={jinx.reason}
				names={[nameOf(jinx.characters[0]), nameOf(jinx.characters[1])]}
			/>
		</p>
	</li>
{/snippet}

<!-- On screen every section closes from its header (Trevor); in print each is a plain heading. -->
{#snippet section(title: string, key: string, body: Snippet, tone?: 'good' | 'evil', empty = false)}
	{#if flat}
		<section data-tone={tone}>
			<h2>{title}</h2>
			{@render body()}
		</section>
	{:else}
		<Collapsible {title} storageKey={key} {tone} {empty}>{@render body()}</Collapsible>
	{/if}
{/snippet}

<div class="sheet" data-density={density}>
	{#each groups as group (group.type)}
		{#snippet list()}
			<ul>
				{#each group.characters as c (c.id)}{@render row(c)}{/each}
			</ul>
		{/snippet}
		{@render section(
			group.type === 'traveller' ? t('player.recommendedTravellers') : TYPE_PLURALS[group.type],
			`play:${group.type}`,
			list,
			TONES[group.type],
			group.type === 'traveller' && !!playing && !group.characters.some((c) => playing.has(c.id))
		)}
	{/each}

	{#snippet jinxList()}
		{#if jinxes.length}
			<ul>
				{#each jinxes as jinx (jinx.characters.join('+'))}{@render jinxItem(jinx)}{/each}
			</ul>
		{:else}
			<p class="none" data-testid="no-jinxes">{t('common.none')}</p>
		{/if}
	{/snippet}
	{@render section(t('player.jinxes'), 'play:jinxes', jinxList, undefined, noJinxInPlay)}

	{#if !flat}
		{#snippet breakdown()}<PlayerCounts {players} />{/snippet}
		{@render section(t('player.breakdown'), 'play:breakdown', breakdown)}
	{/if}
</div>

{#if jinxFor}
	<Dialog bind:open={jinxOpen} title={t('player.jinxes')}>
		<ul class="jinx-dialog">
			{#each jinxesOf[jinxFor.id] ?? [] as jinx (jinx.characters.join('+'))}
				{@render jinxItem(jinx)}
			{/each}
		</ul>
	</Dialog>
{/if}

<style>
	.sheet {
		display: grid;
		/* minmax(0, …) lets the wide Players table scroll inside its section on phones. */
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
	}
	ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(20 * var(--u))), 1fr));
		gap: var(--space-2) var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.character,
	.jinx {
		display: grid;
		justify-items: start;
		gap: calc(0.125 * var(--u));
		align-content: start;
	}
	.pair {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.ability {
		margin: 0;
		padding-left: var(--space-1);
		font-family: var(--font-ability);
		line-height: 1.35;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.name {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	/* One tap target holding the icons of the characters this one is jinxed with. */
	.jinx-mark {
		display: inline-flex;
		align-items: center;
		gap: calc(0.125 * var(--u));
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		padding: 0 var(--space-1);
		border: 0;
		background: none;
		cursor: pointer;
		touch-action: manipulation;
	}
	.jinx-mark img,
	.jinx-mark .dot {
		width: 1.6em;
		height: 1.6em;
		border-radius: 50%;
		background: var(--token-face);
	}
	.jinx-dialog {
		grid-template-columns: minmax(0, 1fr);
	}
	section h2 {
		margin: 0 0 var(--space-2);
		font-size: 1.1rem;
		color: var(--heading);
	}
	section[data-tone='good'] h2 {
		color: var(--good);
	}
	section[data-tone='evil'] h2 {
		color: var(--evil);
	}

	/* Compact: name and ability side by side, more per row (Trevor approved, 2026-10-16). */
	[data-density='compact'],
	[data-density='super'] {
		gap: var(--space-3);
	}
	[data-density='compact'] ul {
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(24 * var(--u))), 1fr));
		gap: var(--space-1) var(--space-3);
	}
	[data-density='compact'] .character,
	[data-density='super'] .character {
		grid-template-columns: auto minmax(0, 1fr);
		align-items: baseline;
		column-gap: var(--space-1);
	}
	[data-density='compact'] .ability {
		font-size: 0.9rem;
		line-height: 1.25;
		padding-left: 0;
	}
	/* Super-compact: smaller text, tighter rows, so a long script fits a phone or a page. */
	[data-density='super'] {
		font-size: 0.85rem;
	}
	[data-density='super'] ul {
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(22 * var(--u))), 1fr));
		gap: calc(0.25 * var(--u)) var(--space-2);
	}
	[data-density='super'] .ability {
		font-size: 0.8rem;
		line-height: 1.15;
		padding-left: 0;
	}
	[data-density='super'] .jinx-mark img,
	[data-density='super'] .jinx-mark .dot {
		width: 1.3em;
		height: 1.3em;
	}
</style>
