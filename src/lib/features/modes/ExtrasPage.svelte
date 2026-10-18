<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import {
		announcedRange,
		extraCandidates,
		extraCounts,
		NO_RESTRICTIONS,
		rollExtras,
		STANDARD
	} from '#lib/core/modes/index.ts';
	import type { SeatedType } from '#lib/core/rules/distribution.ts';
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
	import Page from '#lib/ui/layout/Page.svelte';
	import { findMode } from './custom-modes.svelte.ts';
	import { readGameMode } from './game-mode-store.ts';
	import { readExtras, writeExtras } from './mode-extras.ts';

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
	const record = $derived(readGameMode(gameId));
	const mode = $derived(findMode(record?.modeId ?? '') ?? STANDARD);
	const restrictions = $derived(record?.restrictions ?? NO_RESTRICTIONS);
	const pool = $derived(mode.parts.pool);
	const announce = $derived(pool?.kind === 'script-plus-hidden' && pool.announceRange);
	const scriptCharacters = $derived(
		game.script.entries.flatMap((e): Character[] => {
			const c = e.kind === 'custom' ? e.character : port.lookup?.get(e.id);
			return c ? [c] : [];
		})
	);

	/**
	 * One row per type the Storyteller may add a hidden character of (Trevor, 2026-10-18:
	 * Townsfolk, Outsider and Minion), more where the mode adds several of a type. Any row
	 * can be left empty.
	 */
	const ROW_TYPES: readonly SeatedType[] = ['townsfolk', 'outsider', 'minion'];
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

	const range = $derived(announcedRange(extras.length));

	/**
	 * Puts the extras into the setup selection, taking out any earlier roll first: the setup
	 * screen only offers the script, so an off-script character selected there came from here.
	 */
	async function next() {
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
		await goto(resolve('/grimoire/[gameId]/setup', { gameId }));
	}
</script>

<Page title={t('modes.extras.title')} width="text">
	{#snippet actions()}
		<Button icon="random" disabled={official.length === 0} onclick={roll}>
			{t('modes.extras.rollAll')}
		</Button>
	{/snippet}

	<!-- One row per type, always drawn, so choosing or rolling never moves anything. -->
	<ul class="extras" data-testid="extras">
		{#each rowTypes as type, i (i)}
			{@const extra = rows[i]}
			<li class="extra">
				<span class="muted">{TYPE_LABELS[type]}</span>
				{#if extra}
					<CharacterBadge characterId={extra.id} character={extra} />
				{:else}
					<span class="muted">{t('common.none')}</span>
				{/if}
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
		<p data-testid="extras-range">
			{t('modes.extras.announce', { low: range[0], high: range[1] })}
		</p>
	{/if}

	<div class="next">
		<Button variant="accent" icon="forward" disabled={official.length === 0} onclick={next}>
			{t('modes.extras.next')}
		</Button>
	</div>
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
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.extra {
		display: grid;
		grid-template-columns: minmax(calc(6 * var(--u)), auto) 1fr auto;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--card-border);
		border-radius: var(--radius-sm);
	}
	.tools {
		display: flex;
		gap: var(--space-1);
	}
	.muted {
		color: var(--on-surface-muted);
	}
	p {
		margin: 0;
	}
	.next {
		display: flex;
		justify-content: flex-end;
	}
</style>
