<script lang="ts">
	import SetupNav from '#lib/features/setup/SetupNav.svelte';
	import { backToNewGame } from './new-game-draft.ts';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import {
		announceBounds,
		announcedRange,
		extraCandidates,
		extraCounts,
		extraTotal,
		NO_RESTRICTIONS,
		rollExtras,
		STANDARD
	} from '#lib/core/modes/index.ts';
	import type { SeatedType } from '#lib/core/rules/distribution.ts';
	import { setupComplete } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import type { SetupGamePort } from '#lib/features/setup/game-port.ts';
	import { setupSelection } from '#lib/features/setup/selection.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import { readGameMode } from './game-mode-store.ts';
	import { gameModeOf } from './game-mode.ts';
	import { readExtras, writeExtras } from './mode-extras.ts';
	import RuleHeader from './RuleHeader.svelte';
	import { spawnedBy } from './spawned-by.ts';
	import { dealTitle } from './deal-title.ts';
	import { setupHref } from './start.ts';

	/**
	 * The hidden extra characters of a mode like A Script of Infinite Possibilities, for the
	 * Storyteller's eyes only: characters from off the script, rolled at random, with the
	 * range the Storyteller may tell the table
	 * (https://chillclocktower.com/2024/04/28/a-script-of-infinite-possibilities/). They are
	 * kept off the game's script, which the players' phones show, and go into the setup
	 * selection, so the bag and the draw treat them like any chosen character.
	 */
	interface Props {
		port: SetupGamePort;
	}

	let { port }: Props = $props();

	const game = $derived(port.game!);
	const gameId = $derived(game.gameId);
	/** Opened from Game info once the game is set up: the bar goes back to the board instead. */
	const started = $derived(setupComplete(game));
	const record = $derived(readGameMode(gameId));
	const mode = $derived(gameModeOf(gameId) ?? STANDARD);
	const restrictions = $derived(record?.restrictions ?? NO_RESTRICTIONS);
	const pool = $derived(mode.parts.pool);
	/** The mode or rules that hide characters, shown at the top. */
	const spawning = $derived(spawnedBy(gameId, (p) => p.pool?.kind === 'script-plus-hidden'));
	const announce = $derived(pool?.kind === 'script-plus-hidden' && pool.announceRange);
	const scriptCharacters = $derived(
		game.script.entries.flatMap((e): Character[] => {
			const c = e.kind === 'custom' ? e.character : port.lookup?.get(e.id);
			return c ? [c] : [];
		})
	);

	/**
	 * One row per type the Storyteller may add a hidden character of (Trevor, 2026-10-19:
	 * one each of Townsfolk, Outsider, Minion and Demon), more where the mode adds several of
	 * a type. Any row can be left empty.
	 */
	const ROW_TYPES: readonly SeatedType[] = ['townsfolk', 'outsider', 'minion', 'demon'];
	const rowTypes = $derived(
		ROW_TYPES.flatMap((type) =>
			Array.from({ length: Math.max(1, extraCounts(mode)[type] ?? 0) }, () => type)
		)
	);

	let official = $state.raw<readonly Character[]>([]);
	/** The character in each row, or undefined for none. */
	let rows = $state.raw<(Character | undefined)[]>([]);

	/** Puts characters into the rows of their type, in order. */
	function fill(characters: readonly Character[]): (Character | undefined)[] {
		const left = [...characters];
		return rowTypes.map((type) => {
			const at = left.findIndex((c) => c.type === type);
			return at >= 0 ? left.splice(at, 1)[0] : undefined;
		});
	}

	$effect(() => {
		let cancelled = false;
		loadOfficialData()
			.then((data) => {
				if (cancelled) return;
				official = data.characters;
				const saved = readExtras(gameId)?.flatMap((id) => data.byId.get(id) ?? []);
				if (saved) rows = fill(saved);
				else roll();
			})
			.catch((e) => reportError(e, { area: 'grimoire' }));
		return () => (cancelled = true);
	});

	const extras = $derived(rows.filter((c): c is Character => c !== undefined));

	function keep(next: (Character | undefined)[]) {
		rows = next;
		writeExtras(
			gameId,
			next.flatMap((c) => (c ? [c.id] : []))
		);
	}

	function roll() {
		keep(fill(rollExtras(mode, scriptCharacters, official, restrictions, Math.random)));
	}

	function candidates(i: number): Character[] {
		return extraCandidates(
			mode,
			rowTypes[i],
			scriptCharacters,
			official,
			restrictions,
			rows.filter((c, j): c is Character => j !== i && c !== undefined)
		);
	}

	function rollOne(i: number) {
		const pool = candidates(i).filter((c) => c.id !== rows[i]?.id);
		if (pool.length === 0) return;
		const picked = pool[Math.floor(Math.random() * pool.length)];
		keep(rows.map((c, j) => (j === i ? picked : c)));
	}

	function set(i: number, character: Character | undefined) {
		keep(rows.map((c, j) => (j === i ? character : c)));
	}

	// Choosing a row's character from a list of the ones it can be.
	let choosing = $state(0);
	let picking = $state(false);
	const choices = $derived(picking ? candidates(choosing) : []);

	/** How many in all the mode allows (Trevor, 2026-10-18: 1 to 4 for Infinite Possibilities). */
	const total = $derived(extraTotal(mode));
	/**
	 * What to tell the table: any range that holds the real number (Trevor, 2026-10-19). Starts
	 * one either side; the Storyteller's own pick is kept while it still holds the number.
	 */
	const bounds = $derived(announceBounds(extras.length, total));
	let picked = $state<{ low?: number; high?: number }>({});
	const range = $derived.by((): [number, number] => {
		const [low, high] = announcedRange(extras.length, total);
		return [
			picked.low !== undefined && bounds.lows.includes(picked.low) ? picked.low : low,
			picked.high !== undefined && bounds.highs.includes(picked.high) ? picked.high : high
		];
	});

	/**
	 * Puts the extras into the setup selection, taking out any earlier roll first: the setup
	 * screen only offers the script, so an off-script character selected there came from here.
	 */
	async function goNext() {
		setupSelection.open(gameId, game.seating.length);
		const onScript = new Set(scriptCharacters.map((c) => c.id));
		const types = new Set<string>(ROW_TYPES);
		const ids = new Set<CharacterId>(extras.map((c) => c.id));
		for (const id of Object.keys(setupSelection.state.selection)) {
			const type = port.lookup?.get(id)?.type;
			if (!onScript.has(id) && !ids.has(id) && type && types.has(type))
				setupSelection.setCopies(id, 0);
		}
		for (const id of ids) setupSelection.setCopies(id, 1);
		await goto(setupHref(gameId));
	}
</script>

<Page title={t('modes.extras.title')}>
	{#snippet actions()}
		<Button icon="random" disabled={official.length === 0} onclick={roll}>
			{t('modes.extras.rollAll')}
		</Button>
	{/snippet}

	<RuleHeader rules={spawning} />

	<!-- One row per type, always drawn, so choosing or rolling never moves anything. -->
	<ul class="extras" data-testid="extras">
		{#each rowTypes as type, i (i)}
			{@const extra = rows[i]}
			<li class="extra">
				<span class="muted">{TYPE_LABELS[type]}</span>
				<span class="pick">
					{#if extra}
						<CharacterBadge characterId={extra.id} character={extra} />
					{:else}
						<span class="muted">{t('common.none')}</span>
					{/if}
				</span>
				<span class="tools">
					<IconButton
						icon="search"
						label={t('modes.extras.choose', { type: TYPE_LABELS[type] })}
						disabled={official.length === 0}
						onclick={() => {
							choosing = i;
							picking = true;
						}}
					/>
					<IconButton
						icon="random"
						label={extra
							? t('modes.extras.rollOne', { name: extra.name })
							: t('modes.extras.rollType', { type: TYPE_LABELS[type] })}
						disabled={official.length === 0}
						onclick={() => rollOne(i)}
					/>
					<DeleteButton
						label={t('modes.extras.clear', { type: TYPE_LABELS[type] })}
						disabled={!extra}
						onclick={() => set(i, undefined)}
					/>
				</span>
			</li>
		{/each}
	</ul>

	{#if announce}
		<div class="announce" data-testid="extras-range">
			<span>{t('modes.extras.announceLead')}</span>
			<Select
				label={t('modes.extras.announceLow')}
				hideLabel
				value={String(range[0])}
				options={bounds.lows.map((n) => ({ value: String(n), label: String(n) }))}
				onChange={(value) => (picked = { ...picked, low: Number(value) })}
			/>
			<span>{t('modes.extras.announceTo')}</span>
			<Select
				label={t('modes.extras.announceHigh')}
				hideLabel
				value={String(range[1])}
				options={bounds.highs.map((n) => ({ value: String(n), label: String(n) }))}
				onChange={(value) => (picked = { ...picked, high: Number(value) })}
			/>
			<span>{t('modes.extras.announceTail')}</span>
		</div>
	{/if}

	<!-- The start flow's bar, Back to New game as it was (Trevor, 2026-10-23). Once the game
	     is set up, the bar goes back to the board and choosing characters is done. -->
	{#if started}
		<SetupNav backHref={resolve('/grimoire/[gameId]', { gameId })} backLabel={t('setup.grimoire')}>
			{#snippet next()}{/snippet}
		</SetupNav>
	{:else}<SetupNav onBack={() => void backToNewGame(gameId)} backLabel={t('setup.newGame')}>
			{#snippet next()}
				<Button
					variant="accent"
					icon="forward"
					disabled={official.length === 0 || extras.length < total.min || extras.length > total.max}
					onclick={goNext}
				>
					{setupHref(gameId).endsWith('/deal') ? dealTitle(gameId) : t('modes.extras.next')}
				</Button>
			{/snippet}
		</SetupNav>{/if}
</Page>

<Dialog
	bind:open={picking}
	title={t('modes.extras.choose', { type: TYPE_LABELS[rowTypes[choosing] ?? 'townsfolk'] })}
	size="full"
>
	<CharacterPicker
		characters={choices}
		onSelect={(id) => {
			const picked = choices.find((c) => c.id === id);
			if (picked) set(choosing, picked);
			picking = false;
		}}
	/>
</Dialog>

<style>
	.extras {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Rows with dividers, not boxes (Trevor: stacked items are delineated). The pick's column
	   can shrink, so a long name ends in "…" inside its badge and the tools keep their place
	   (Trevor, 2026-10-23: "long name pushes rest of stuff to side"). */
	.extra {
		display: grid;
		grid-template-columns: minmax(calc(6 * var(--u)), auto) minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding-block: var(--space-1);
	}
	.extra + .extra {
		border-top: 1px solid var(--border); /* px-ok: hairline divider */
	}
	.pick {
		display: flex;
		min-width: 0;
	}
	.tools {
		display: flex;
		gap: var(--space-1);
	}
	.muted {
		color: var(--on-surface-muted);
	}
	.announce {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
</style>
