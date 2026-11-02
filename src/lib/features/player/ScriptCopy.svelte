<script lang="ts">
	import type { TravellerInPlay } from './travellers-in-play.ts';
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { playerJinxes, sheetCharacters } from './player-script.ts';
	import ScriptByline from './ScriptByline.svelte';
	import type { PublicRule } from '#lib/core/sync/public-projection.ts';
	import ScriptSheet from './ScriptSheet.svelte';
	import ScriptName from '#lib/features/scripts/ScriptName.svelte';
	import { scriptLogo } from '#lib/core/data/script-logo.ts';
	import SheetBackgroundSelect from './SheetBackgroundSelect.svelte';
	import { playerSettings } from './player-settings.svelte.ts';
	import { sheetStyle } from '#lib/ui/themes/sheet-backgrounds.ts';

	/**
	 * The players' copy of a script: the /play Script tab, as one component. The Storyteller's
	 * board opens this same component, so what they see matches the players' copy exactly
	 * (Trevor, 2026-10-16).
	 */
	interface Props {
		script: LoadedScript;
		/** Seats at the table; highlights that column of the Players breakdown. */
		players?: number;
		/** The script's version, when its source has one (BotC Scripts). */
		version?: string;
		/** False where the page already shows the author and version (the /play header). */
		byline?: boolean;
		/** Characters on seats, in a game: Travellers and Jinxes start closed when none plays. */
		inPlay?: readonly string[];
		/** Travellers the town knows are in play, with their players (Trevor, 2026-10-19). */
		travellers?: readonly TravellerInPlay[];
		/** The game mode and special rules, listed under Jinxes. */
		rules?: readonly PublicRule[];
		/** The Fabled and Loric in play, in a game: their setup change shows in the Players counts. */
		ruleCharacters?: readonly string[];
		/** False leaves the Players breakdown out (New game's preview, beside its own table). */
		showBreakdown?: boolean;
		/** False where the host's header has the light background switch (PlayerScriptActions). */
		backgroundChoice?: boolean;
		/** The script's name above the author, as /play's title shows it (New game's preview). */
		title?: boolean;
	}

	let {
		script,
		players,
		version,
		byline = true,
		inPlay,
		travellers,
		rules,
		ruleCharacters: ruleIds = [],
		showBreakdown = true,
		backgroundChoice = true,
		title = false
	}: Props = $props();

	$effect(() => {
		if (!officialData.current) void loadOfficialData();
	});
	const data = $derived(officialData.current);
	const listed = $derived(data ? sheetCharacters(script, data) : []);
	/** The script's recommended Travellers, marked as such on their rows. */
	const recommended = $derived(
		new Set(listed.filter((c) => c.type === 'traveller').map((c) => c.id))
	);
	// In a game the Travellers are the ones in play, each marked recommended or not, rather
	// than the recommended list (Trevor, 2026-11-02: a Voudon added though not recommended
	// showed under Recommended Travellers). Outside a game, the recommended ones.
	const characters = $derived.by(() => {
		if (!data) return [];
		if (inPlay === undefined && travellers === undefined) return listed;
		const ids = [...(travellers ?? []).map((p) => p.characterId), ...(inPlay ?? [])];
		const playing = ids
			.filter((id, i) => ids.indexOf(id) === i)
			.flatMap((id) => {
				const c = listed.find((l) => l.id === id) ?? data.byId.get(id);
				return c?.type === 'traveller' ? [c] : [];
			});
		return [...listed.filter((c) => c.type !== 'traveller'), ...playing];
	});
	const jinxes = $derived(data ? playerJinxes(script, data) : []);
	// A custom Fabled or Loric is found on the script.
	const ruleCharacters = $derived(
		data
			? ruleIds.flatMap((id) => characters.find((c) => c.id === id) ?? data.byId.get(id) ?? [])
			: []
	);
</script>

<!-- The background choice sits at the top of every copy, unless its host's header has it,
     and in Settings > Player (Trevor, 2026-10-23, colours 2026-10-24). -->
<div
	class="copy"
	class:painted={playerSettings.current.sheetBackground !== 'theme'}
	style={sheetStyle(playerSettings.current.sheetBackground)}
	data-testid="script-copy"
>
	{#if title}<ScriptName
			name={script.name}
			logo={scriptLogo(script)}
			size="title"
			testid="script-copy-title"
		/>{/if}
	{#if byline || backgroundChoice}<div class="head">
			{#if byline && data}<ScriptByline author={script.meta.author} {version} />{/if}
			{#if backgroundChoice}<span class="background-choice"><SheetBackgroundSelect compact /></span
				>{/if}
		</div>{/if}
	{#if data}
		<ScriptSheet
			{characters}
			{jinxes}
			{players}
			{inPlay}
			{travellers}
			{recommended}
			{rules}
			{ruleCharacters}
			{showBreakdown}
		/>
	{:else}
		<p class="muted">{t('player.loading')}</p>
	{/if}
</div>

<style>
	.copy {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-3);
		/* Padded either way, so turning the light background on moves nothing. */
		padding: var(--space-3);
		border-radius: var(--radius-md);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		/* The line between the byline and the first section (Trevor, 2026-10-27). */
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.background-choice {
		margin-left: auto;
	}
	/* The colours themselves are the chosen background's (themes/sheet-backgrounds.ts), set on the element. */
	.painted {
		background: var(--surface);
		color: var(--on-surface);
		/* Pinned headings in the paper's colour, not the page's. */
		--pin-background: var(--surface);
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
