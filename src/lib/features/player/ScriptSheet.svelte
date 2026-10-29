<script lang="ts">
	import { typeTone, type TypeTone } from '#lib/core/data/character-type.ts';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import type { ScriptJinx } from '#lib/core/rules/jinxes.ts';
	import type { PublicRule } from '#lib/core/sync/public-projection.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { fallbackIconUrl, iconUrl } from '#lib/features/characters/icon-url.ts';
	import { iconFallback } from '#lib/ui/token/icon-fallback.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import SectionStack from '#lib/ui/layout/SectionStack.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { Snippet } from 'svelte';
	import PlayerCounts from './PlayerCounts.svelte';
	import { scriptMaxPlayers } from '#lib/core/rules/index.ts';
	import { groupByType } from './player-script.ts';
	import type { SheetDensity } from './player-settings.svelte.ts';
	import type { TravellerInPlay } from './travellers-in-play.ts';

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
		/** Travellers the town knows are in play: each shows who plays it (Trevor, 2026-10-19). */
		travellers?: readonly TravellerInPlay[];
		/** False leaves the Jinxes section out (a printed sheet without them). */
		showJinxes?: boolean;
		/** The game mode and special rules, in their own section under Jinxes; none, none shown. */
		rules?: readonly PublicRule[];
		/** The Fabled and Loric in play, in a game: their setup change shows in the Players counts. */
		ruleCharacters?: readonly Character[];
		/** False leaves the Players breakdown out (New game's preview, beside its own table). */
		showBreakdown?: boolean;
		/** Printing picks whatever fits one page; on screen it is always Normal. */
		density?: SheetDensity;
	}

	let {
		characters,
		jinxes,
		players,
		flat = false,
		inPlay,
		travellers,
		showJinxes = true,
		rules = [],
		ruleCharacters = [],
		showBreakdown = true,
		density: fixed
	}: Props = $props();
	const playing = $derived(
		inPlay || travellers
			? new Set([...(inPlay ?? []), ...(travellers ?? []).map((p) => p.characterId)])
			: undefined
	);
	const playersOf = (id: string) =>
		(travellers ?? [])
			.filter((p) => p.characterId === id)
			.map((p) => p.playerName ?? t('common.seat', { number: p.seatNumber }));
	const noJinxInPlay = $derived(
		!!playing && !jinxes.some((j) => j.characters.every((id) => playing.has(id)))
	);
	const density = $derived(fixed ?? 'normal');
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
</script>

<!-- On screen a character is its icon in a ring of its alignment's colour, with a band of
     that colour carrying its name out of the ring's top and the ability under the band (Trevor,
     2026-10-28: the icons were "kind of hidden"; he picked the ring over a solid disc), on screen
     and on paper. It is the shared CharacterRow's ring look. -->
{#snippet ringRow(c: Character)}
	{@const own = jinxesOf[c.id]}
	{@const who = playersOf(c.id)}
	<li class="character" data-character={c.id}>
		<CharacterRow character={c} info>
			{#snippet afterName()}
				{#if own}{@render jinxMark(c, own)}{/if}
				{#if who.length}<span class="in-play" data-testid="traveller-in-play"
						>{t('player.travellerInPlay', { names: who.join(', ') })}</span
					>{/if}
			{/snippet}
			{#snippet ability()}<GlossaryText text={c.ability} {names} />{/snippet}
		</CharacterRow>
	</li>
{/snippet}

{#snippet jinxMark(c: Character, own: ScriptJinx[])}
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
			{#if src}<img
					{src}
					alt=""
					referrerpolicy="no-referrer"
					{@attach iconFallback(fallbackIconUrl(p))}
				/>{:else}<span class="dot"></span>{/if}
		{/each}
	</button>
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
{#snippet section(
	title: string,
	key: string,
	body: Snippet,
	tone?: TypeTone,
	empty = false,
	count?: number
)}
	{#if flat}
		<section data-tone={tone}>
			<h2>{title}</h2>
			{@render body()}
		</section>
	{:else}
		<Collapsible {title} storageKey={key} {tone} {empty} {count}>{@render body()}</Collapsible>
	{/if}
{/snippet}

{#snippet sections()}
	{#each groups as group (group.type)}
		{#snippet list()}
			<ul>
				{#each group.characters as c (c.id)}{@render ringRow(c)}{/each}
			</ul>
		{/snippet}
		{@render section(
			group.type === 'traveller' ? t('player.recommendedTravellers') : TYPE_PLURALS[group.type],
			`play:${group.type}`,
			list,
			typeTone(group.type),
			group.type === 'traveller' && !!playing && !group.characters.some((c) => playing.has(c.id)),
			group.characters.length
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
	{#if showJinxes}{@render section(
			t('player.jinxes'),
			'play:jinxes',
			jinxList,
			undefined,
			noJinxInPlay,
			jinxes.length
		)}{/if}

	{#snippet ruleList()}
		<ul>
			{#each rules as rule (rule.id)}
				<li class="rule" data-testid="sheet-rule">
					<span class="rule-name">{rule.name}</span>
					{#if rule.text}<p class="ability"><GlossaryText text={rule.text} {names} /></p>{/if}
				</li>
			{/each}
		</ul>
	{/snippet}
	{#if rules.length}{@render section(
			t('player.modeAndRules'),
			'play:rules',
			ruleList,
			undefined,
			false,
			rules.length
		)}{/if}

	{#if !flat && showBreakdown}
		{#snippet breakdown()}<PlayerCounts
				{players}
				maxPlayers={scriptMaxPlayers(characters)}
				travellers={(travellers ?? []).flatMap((p) => byId.get(p.characterId) ?? [])}
				{ruleCharacters}
			/>{/snippet}
		{@render section(t('player.breakdown'), 'play:breakdown', breakdown)}
	{/if}
{/snippet}

<!-- On screen the sections stack with the app's one line between them (SectionStack). -->
<div class="sheet" data-density={density}>
	{#if flat}{@render sections()}{:else}<SectionStack>{@render sections()}</SectionStack>{/if}
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
	/* In print, a line across the whole sheet where one character type gives way to the next
	   (Trevor, 2026-10-23: "a line that covers the screen to show the delineation"); on screen
	   SectionStack draws it. */
	.sheet > :global(section + section) {
		padding-top: var(--space-3);
		border-top: var(--card-border);
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
	.jinx,
	.rule {
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
	/*
	 * A badge above its ability keeps the row it had as a tall pill: its 44px tap area then
	 * stays clear of the rules terms' tap areas on the line below, and nothing moves.
	 */
	.pair {
		min-height: var(--tap-target);
		align-items: center;
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
	/* A rule has no badge: its name at the badge's height keeps the rows even. */
	.rule-name {
		display: flex;
		align-items: center;
		min-height: var(--tap-target);
		font-family: var(--font-control);
		font-weight: 600;
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
	.in-play {
		padding: 0 0.5em;
		border-radius: var(--radius-full);
		background: var(--traveller-text);
		color: var(--surface);
		font-family: var(--font-control);
		font-size: 0.75rem;
		font-weight: 600;
	}
	.jinx-dialog {
		grid-template-columns: minmax(0, 1fr);
	}
	/* A faint line under each jinx, as in the Reference's lists (Trevor, 2026-10-18). */
	.jinx {
		padding-bottom: var(--space-2);
		border-bottom: var(--card-border);
	}
	section h2 {
		margin: 0 0 var(--space-2);
		font-size: 1.1rem;
		color: var(--heading);
	}
	section[data-tone='good'] h2 {
		color: var(--good-text);
	}
	section[data-tone='evil'] h2 {
		color: var(--evil-text);
	}
	section[data-tone='traveller'] h2 {
		color: var(--traveller-text);
	}
	section[data-tone='loric'] h2 {
		color: var(--loric-text);
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
	/* In the band the jinx icons keep a 44px tap area without making the band taller. */
	.character .jinx-mark {
		position: relative;
		flex: 0 4 auto;
		min-width: 0;
		min-height: 0;
		padding: 0;
		/* Many partners (a script with every character) end at the band's end, never past it. */
		overflow-x: clip;
	}
	.character .jinx-mark::before {
		content: '';
		position: absolute;
		inset: calc((1.6em - var(--tap-target)) / 2) 0;
	}
	.character .jinx-mark img,
	.character .jinx-mark .dot {
		width: 1.3em;
		height: 1.3em;
	}
	/* Printed compact sheets: smaller rings, so more fits a page. */
	[data-density='compact'] .character {
		--character-ring: 3.4em;
	}
	[data-density='super'] .character {
		--character-ring: 2.8em;
	}
</style>
