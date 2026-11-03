<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		OFFICIAL_EDITIONS,
		CHARACTER_TYPES,
		type Character,
		type CharacterId,
		type GameData,
		type Jinx
	} from '#lib/core/data/index.ts';
	import {
		labOpponents,
		OPPONENT_PLACES,
		pairingKey,
		stepCharacter,
		type OpponentPlace,
		type OpponentSource
	} from '#lib/core/lab/lab-game.ts';
	import { MAX_DEALT_PLAYERS, MIN_PLAYERS } from '#lib/core/rules/distribution.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import JinxMark from '#lib/features/characters/JinxMark.svelte';
	import JinxNote from '#lib/features/characters/JinxNote.svelte';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import CharacterDataDialog from '#lib/features/reference/CharacterDataDialog.svelte';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import DeviceFrame from '#lib/features/test-room/DeviceFrame.svelte';
	import { STORYTELLER_SCREENS } from '#lib/features/test-room/devices.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import FileView from '#lib/ui/primitives/FileView.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { lab, type Mark } from './lab-store.svelte.ts';
	import { LAB_SCRIPT_NAME, loadLabGame } from './load-lab-game.ts';

	// The Character Lab (plan M37, Trevor 2026-11-03: "lock philosopher and tea lady on a script
	// and then just keep cycling through or manually changing like the different opposing
	// characters"; "You should be able to inspect all data used for a character"): quick games
	// loaded into the real app, a Storyteller screen beside the controls on a wide screen.

	onMount(() => void loadOfficialData());

	const setup = $derived(lab.current);
	const data = $derived(officialData.current);
	const opponents = $derived(data ? labOpponents(data, setup.locked, setup.source) : []);
	const at = $derived(Math.min(setup.index, Math.max(0, opponents.length - 1)));
	const current = $derived(opponents[at]);
	const byId = (id: CharacterId): Character | undefined => data?.byId.get(id);

	/** The jinxes in the loaded game's pairing: the locked characters' own, and the opponent's. */
	const pairJinxes = $derived.by((): Jinx[] => {
		if (!data) return [];
		const ids = new Set([...setup.locked, ...(current ? [current.id] : [])]);
		return data.jinxes.all.filter(({ characters: [a, b] }) => ids.has(a) && ids.has(b));
	});

	const jinxCount = $derived(
		data ? labOpponents(data, setup.locked, { kind: 'jinxes' }).length : 0
	);
	const picked = $derived(setup.source.kind === 'picked' ? setup.source.ids : []);
	/** The source drop-down's value: a word for each kind, the type for a type. */
	const sourceValue = $derived(
		setup.source.kind === 'type' ? `type:${setup.source.type}` : setup.source.kind
	);
	const sourceOptions = $derived([
		{
			value: 'jinxes',
			label: t('lab.source.jinxes'),
			description: t('lab.characters', { count: jinxCount })
		},
		...CHARACTER_TYPES.map((type) => ({ value: `type:${type}`, label: TYPE_PLURALS[type] })),
		{ value: 'all', label: t('lab.source.all') },
		{
			value: 'picked',
			label: t('lab.source.picked'),
			description: t('lab.characters', { count: picked.length })
		}
	]);
	function setSource(value: string) {
		const source: OpponentSource = value.startsWith('type:')
			? { kind: 'type', type: value.slice(5) as (typeof CHARACTER_TYPES)[number] }
			: value === 'all'
				? { kind: 'all' }
				: value === 'picked'
					? { kind: 'picked', ids: [...picked] }
					: { kind: 'jinxes' };
		lab.update({ source, index: 0 });
	}
	const placeOptions = OPPONENT_PLACES.map((place) => ({
		value: place,
		label: t(`lab.place.${place}`)
	}));
	const fillerOptions = OFFICIAL_EDITIONS.map((e) => ({ value: e.id, label: e.name }));

	const markOf = (id: CharacterId): Mark | undefined => setup.marks[pairingKey(setup.locked, id)];
	const tally = $derived.by(() => {
		let works = 0;
		let problems = 0;
		for (const o of opponents) {
			const mark = markOf(o.id);
			if (mark === 'works') works++;
			else if (mark === 'problem') problems++;
		}
		return { works, problems };
	});
	function mark(value: Mark) {
		if (!current) return;
		const key = pairingKey(setup.locked, current.id);
		const marks = { ...setup.marks };
		if (marks[key] === value) delete marks[key];
		else marks[key] = value;
		lab.update({ marks });
	}

	// ── Loading a game ──
	let loading = $state(false);
	/** The content's width: a Storyteller screen shows beside the controls once there's room. */
	let contentWidth = $state(0);
	const wide = $derived(contentWidth >= 600);
	let screenId = $state(STORYTELLER_SCREENS[0].id);
	const screen = $derived(STORYTELLER_SCREENS.find((s) => s.id === screenId)!);
	const screenOptions = STORYTELLER_SCREENS.map((s) => ({
		value: s.id,
		label: `${s.name} · ${s.width}×${s.height}`
	}));
	const gamePath = $derived(
		setup.gameId ? resolve('/grimoire/[gameId]', { gameId: setup.gameId }) : undefined
	);
	/** Bumped on each load, so the frame opens the new game even at the same address. */
	let loads = $state(0);

	async function load(index = at) {
		if (loading) return;
		loading = true;
		try {
			const game: GameData = data ?? (await loadOfficialData());
			const list = labOpponents(game, setup.locked, setup.source);
			const i = Math.min(Math.max(0, index), Math.max(0, list.length - 1));
			const open = await loadLabGame(
				game,
				{
					playerCount: setup.playerCount,
					locked: setup.locked,
					opponent: list[i]?.id,
					place: setup.place,
					filler: setup.filler
				},
				setup.gameId
			);
			lab.update({ index: i, gameId: open.game.gameId });
			loads++;
			if (!wide) await goto(resolve('/grimoire/[gameId]', { gameId: open.game.gameId }));
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		} finally {
			loading = false;
		}
	}

	// ── Pickers and dialogs ──
	let lockOpen = $state(false);
	let pickOpen = $state(false);
	let resultsOpen = $state(false);
	let inspecting = $state<Character>();
	let inspectOpen = $state(false);
	function inspect(id: CharacterId) {
		inspecting = byId(id);
		inspectOpen = !!inspecting;
	}
	function lock(id: CharacterId) {
		if (!setup.locked.includes(id)) lab.update({ locked: [...setup.locked, id], index: 0 });
		lockOpen = false;
	}
	/**
	 * The first locked character is the one under test: Previous and Next character swap it for
	 * the one before or after it, and load that game (Trevor, 2026-11-03: "so that you don't
	 * have to go into the character selector each time"). With Jinxes chosen, only characters
	 * with a jinx.
	 */
	const testing = $derived(setup.locked[0]);
	function stepTesting(step: -1 | 1) {
		if (!data || !testing) return;
		const next = stepCharacter(
			data,
			testing,
			step,
			setup.locked.slice(1),
			setup.source.kind === 'jinxes'
		);
		if (!next) return;
		lab.update({ locked: [next, ...setup.locked.slice(1)], index: 0 });
		void load(0);
	}
	function unlock(id: CharacterId) {
		lab.update({ locked: setup.locked.filter((l) => l !== id), index: 0 });
	}
	function togglePicked(id: CharacterId) {
		const ids = picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id];
		lab.update({ source: { kind: 'picked', ids } });
	}

	const resultsText = $derived(
		JSON.stringify(
			Object.entries(setup.marks).map(([pairing, result]) => ({
				pairing: pairing
					.split('+')
					.map((id) => byId(id)?.name ?? id)
					.join(' + '),
				result
			})),
			null,
			'\t'
		)
	);
</script>

<Page title={t('lab.title')}>
	{#snippet actions()}
		<IconButton icon="check" label={t('lab.results')} onclick={() => (resultsOpen = true)} />
	{/snippet}

	{#snippet side()}
		<section class="panel" aria-label={t('lab.title')}>
			<NumberSelect
				label={t('lab.players')}
				hideLabel
				value={setup.playerCount}
				min={MIN_PLAYERS}
				max={MAX_DEALT_PLAYERS + 5}
				format={(count) => t('lab.playersCount', { count })}
				onchange={(playerCount) => lab.update({ playerCount })}
				testid="lab-players"
			/>

			<div class="field">
				<h2>{t('lab.locked')}</h2>
				<!-- Always there, so nothing moves; usable once a character is locked. -->
				<div class="nav" data-testid="lab-testing">
					<Button disabled={loading || !testing} onclick={() => stepTesting(-1)}
						>{t('lab.previousCharacter')}</Button
					>
					<span class="position">
						{#if testing}<CharacterPiece template="badge" characterId={testing} />{:else}{t(
								'common.none'
							)}{/if}
					</span>
					<Button disabled={loading || !testing} onclick={() => stepTesting(1)}
						>{t('lab.nextCharacter')}</Button
					>
				</div>
				<ul class="locked" data-testid="lab-locked">
					{#each setup.locked as id (id)}
						{@const name = byId(id)?.name ?? id}
						<li>
							<CharacterPiece template="badge" characterId={id} />
							<IconButton
								icon="data"
								label={t('lab.inspect', { character: name })}
								onclick={() => inspect(id)}
							/>
							<DeleteButton
								label={t('lab.remove', { character: name })}
								onclick={() => unlock(id)}
							/>
						</li>
					{/each}
					<li><Chip onclick={() => (lockOpen = true)}>{t('lab.add')}</Chip></li>
				</ul>
			</div>

			<div class="row source">
				<Select
					label={t('lab.opponents')}
					value={sourceValue}
					options={sourceOptions}
					onChange={setSource}
				/>
				<!-- Always there, so nothing moves; usable once Hand-picked is chosen. -->
				<Button disabled={setup.source.kind !== 'picked'} onclick={() => (pickOpen = true)}
					>{t('lab.pick')}</Button
				>
			</div>
			<Select
				label={t('lab.place')}
				value={setup.place}
				options={placeOptions}
				onChange={(place: OpponentPlace) => lab.update({ place })}
			/>
			<Select
				label={t('lab.filler')}
				value={setup.filler}
				options={fillerOptions}
				onChange={(filler: (typeof OFFICIAL_EDITIONS)[number]['id']) => lab.update({ filler })}
			/>

			<h2>{t('lab.list')}</h2>
			<ol class="pairings" aria-label={t('lab.list')} data-testid="lab-pairings">
				{#each opponents as opponent, i (opponent.id)}
					{@const result = markOf(opponent.id)}
					{@const name = byId(opponent.id)?.name ?? opponent.id}
					<li data-current={i === at ? '' : undefined} data-testid="lab-pairing">
						<span class="mark" data-mark={result} aria-hidden="true"></span>
						<button
							type="button"
							class="pick"
							aria-current={i === at ? 'true' : undefined}
							onclick={() => lab.update({ index: i })}
						>
							<CharacterPiece template="badge" characterId={opponent.id} interactive={false} />
							{#if result}<span class="visually-hidden">{t(`lab.mark.${result}`)}</span>{/if}
						</button>
						{#if opponent.jinxes.length}
							<JinxMark characterId={opponent.id} jinxes={opponent.jinxes} />
						{/if}
						<IconButton
							icon="data"
							label={t('lab.inspect', { character: name })}
							onclick={() => inspect(opponent.id)}
						/>
					</li>
				{:else}
					<li class="none">{t('common.none')}</li>
				{/each}
			</ol>

			<div class="nav">
				<Button disabled={loading || at === 0} onclick={() => void load(at - 1)}
					>{t('lab.previous')}</Button
				>
				<span class="position" data-testid="lab-position"
					>{opponents.length
						? t('lab.position', { at: at + 1, total: opponents.length })
						: t('common.none')}</span
				>
				<Button disabled={loading || at >= opponents.length - 1} onclick={() => void load(at + 1)}
					>{t('lab.next')}</Button
				>
			</div>
			<p class="tally">{t('lab.tally', tally)}</p>
			<div class="row">
				<Chip
					pressed={!!current && markOf(current.id) === 'works'}
					disabled={!current}
					onclick={() => mark('works')}>{t('lab.mark.works')}</Chip
				>
				<Chip
					pressed={!!current && markOf(current.id) === 'problem'}
					disabled={!current}
					onclick={() => mark('problem')}>{t('lab.mark.problem')}</Chip
				>
			</div>
			<Button variant="accent" disabled={loading || !data} onclick={() => void load()}
				>{loading ? t('lab.loading') : t('lab.load')}</Button
			>
		</section>
	{/snippet}

	<div class="content" bind:clientWidth={contentWidth}>
		<section class="jinxes" aria-label={t('lab.jinxes')}>
			<h2>{t('lab.jinxes')}</h2>
			<!-- A set height that scrolls, so a pairing with more jinxes moves nothing below. -->
			<div class="jinx-list" data-testid="lab-jinxes">
				{#each pairJinxes as jinx (jinx.characters.join('+'))}
					<JinxNote {jinx} />
				{:else}
					<p>{t('common.none')}</p>
				{/each}
			</div>
		</section>
		{#if wide}
			<div class="row">
				<Select
					label={t('lab.screen')}
					hideLabel
					value={screenId}
					options={screenOptions}
					onChange={(id: string) => (screenId = id)}
				/>
				<Button href={gamePath} disabled={!gamePath}>{t('lab.openGame')}</Button>
			</div>
			{#key `${gamePath}:${loads}`}
				<DeviceFrame
					device={screen}
					caption={t('lab.storyteller')}
					title={t('lab.storyteller')}
					src={gamePath ?? resolve('/')}
					zoom={1}
					room={contentWidth}
					testid="lab-frame"
				>
					{#snippet aside()}<span>{LAB_SCRIPT_NAME}</span>{/snippet}
				</DeviceFrame>
			{/key}
		{:else}
			<Button href={gamePath} disabled={!gamePath}>{t('lab.openGame')}</Button>
		{/if}
	</div>

	<Dialog bind:open={lockOpen} title={t('lab.addTitle')} size="full">
		{#if data}
			<CharacterPicker
				characters={data.characters}
				selected={setup.locked}
				onSelect={lock}
				types={CHARACTER_TYPES}
			/>
		{/if}
	</Dialog>

	<Dialog bind:open={pickOpen} title={t('lab.pickTitle')} size="full">
		{#if data}
			<CharacterPicker
				characters={data.characters.filter((c) => !setup.locked.includes(c.id))}
				mode="multi"
				selected={picked}
				onSelect={togglePicked}
				types={CHARACTER_TYPES}
			/>
		{/if}
	</Dialog>

	<Dialog bind:open={resultsOpen} title={t('lab.results')} size="wide">
		<FileView
			title={t('lab.resultsFile')}
			text={resultsText}
			fileName="character-lab-results.json"
			copyLabel={t('lab.copy')}
			downloadLabel={t('lab.download')}
			testid="lab-results"
		/>
	</Dialog>

	{#if inspecting}<CharacterDataDialog bind:open={inspectOpen} character={inspecting} />{/if}
</Page>

<style>
	.panel {
		display: grid;
		gap: var(--space-2);
	}
	h2 {
		margin: 0;
		font-size: 1rem;
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	.row,
	.locked li,
	.pairings li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	/* The drop-down takes the row, as the ones under it take theirs. */
	.source > :global(:first-child) {
		flex: 1;
		min-width: 0;
	}
	.locked,
	.pairings {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	/* The list keeps its height, so a long one scrolls and the controls under it never move. */
	.pairings {
		flex-direction: column;
		flex-wrap: nowrap;
		height: calc(18 * var(--u));
		overflow-y: auto;
		border: 0.0625rem solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-1);
	}
	.pairings li {
		flex-wrap: nowrap;
		padding-inline: var(--space-1);
		border-radius: var(--radius-md);
	}
	.pairings li[data-current] {
		background: var(--surface-selected);
		box-shadow: inset 0.2rem 0 0 var(--accent);
	}
	.pairings .none {
		color: var(--on-surface-muted);
	}
	.pick {
		flex: 1;
		min-width: 0;
		min-height: var(--tap-target);
		display: flex;
		align-items: center;
		background: none;
		border: 0;
		padding: 0;
		color: inherit;
		cursor: pointer;
	}
	/* Hollow until marked, as the Test room's status dots. */
	.mark {
		flex: none;
		width: 0.75em;
		height: 0.75em;
		border: 0.15em solid var(--on-surface-muted);
		border-radius: 50%;
	}
	.mark[data-mark='works'] {
		border-color: var(--good);
		background: var(--good);
	}
	.mark[data-mark='problem'] {
		border-color: var(--evil);
		background: var(--evil);
	}
	.nav {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-2);
	}
	.position,
	.tally {
		margin: 0;
		text-align: center;
		color: var(--on-surface-muted);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}
	.content {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.jinxes {
		display: grid;
		gap: var(--space-1);
	}
	.jinx-list {
		display: grid;
		align-content: start;
		gap: var(--space-2);
		height: calc(9 * var(--u));
		overflow-y: auto;
	}
	.jinx-list p {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
