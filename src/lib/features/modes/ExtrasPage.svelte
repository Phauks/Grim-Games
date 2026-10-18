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
	import { SEATED_TYPES, type SeatedType } from '#lib/core/rules/distribution.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import type { SetupGamePort } from '#lib/features/setup/game-port.ts';
	import { setupSelection } from '#lib/features/setup/selection.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
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
	const wanted = $derived(Object.values(extraCounts(mode)).reduce((sum, n) => sum + (n ?? 0), 0));
	const scriptCharacters = $derived(
		game.script.entries.flatMap((e): Character[] => {
			const c = e.kind === 'custom' ? e.character : port.lookup?.get(e.id);
			return c ? [c] : [];
		})
	);

	const isSeated = (type: string): type is SeatedType =>
		(SEATED_TYPES as readonly string[]).includes(type);

	let official = $state.raw<readonly Character[]>([]);
	let extras = $state.raw<Character[]>([]);

	$effect(() => {
		let cancelled = false;
		loadOfficialData()
			.then((data) => {
				if (cancelled) return;
				official = data.characters;
				const saved = readExtras(gameId)?.flatMap((id) => data.byId.get(id) ?? []);
				if (saved) extras = saved;
				else roll();
			})
			.catch((e) => reportError(e, { area: 'grimoire' }));
		return () => (cancelled = true);
	});

	function keep(next: Character[]) {
		extras = next;
		writeExtras(
			gameId,
			next.map((c) => c.id)
		);
	}

	function roll() {
		keep(rollExtras(mode, scriptCharacters, official, restrictions, Math.random));
	}

	function rollOne(i: number) {
		const type = extras[i]?.type;
		if (!type || !isSeated(type)) return;
		const candidates = extraCandidates(
			mode,
			type,
			scriptCharacters,
			official,
			restrictions,
			extras
		);
		if (candidates.length === 0) return;
		const picked = candidates[Math.floor(Math.random() * candidates.length)];
		keep(extras.map((c, j) => (j === i ? picked : c)));
	}

	const range = $derived(announcedRange(extras.length));

	/**
	 * Puts the extras into the setup selection, taking out any earlier roll first: the setup
	 * screen only offers the script, so an off-script character selected there came from here.
	 */
	async function next() {
		setupSelection.open(gameId, game.seating.length);
		const onScript = new Set(scriptCharacters.map((c) => c.id));
		const types = new Set(Object.keys(extraCounts(mode)));
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

	<!-- One row per extra the mode asks for, so rolling never moves anything. -->
	<ul class="extras" data-testid="extras">
		{#each Array.from({ length: Math.max(wanted, extras.length) }, (_, i) => i) as i (i)}
			{@const extra = extras[i]}
			<li class="extra">
				{#if extra}
					<span class="muted">{TYPE_LABELS[extra.type]}</span>
					<CharacterBadge characterId={extra.id} character={extra} />
					<IconButton
						icon="random"
						label={t('modes.extras.rollOne', { name: extra.name })}
						onclick={() => rollOne(i)}
					/>
				{:else}
					<span class="muted">{t('common.none')}</span>
				{/if}
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
