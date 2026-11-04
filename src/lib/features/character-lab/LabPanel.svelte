<script lang="ts">
	import { CHARACTER_TYPES, OFFICIAL_EDITIONS, type Character } from '#lib/core/data/index.ts';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { OPPONENT_PLACES, type LabFiller, type OpponentPlace } from '#lib/core/lab/lab-game.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import JinxNote from '#lib/features/characters/JinxNote.svelte';
	import CharacterDataDialog from '#lib/features/reference/CharacterDataDialog.svelte';
	import ReportButton from '#lib/features/reports/ReportButton.svelte';
	import PlayerCountSheet from '#lib/features/setup/PlayerCountSheet.svelte';
	import DeviceFrame from '#lib/features/test-room/DeviceFrame.svelte';
	import { STORYTELLER_SCREENS } from '#lib/features/test-room/devices.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import AddRow from '#lib/ui/primitives/AddRow.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { lab } from './lab-store.svelte.ts';
	import type { LabSession } from './lab-session.svelte.ts';
	import { LAB_SCRIPT_NAME } from './load-lab-game.ts';

	/**
	 * The Character Lab's controls on the Characters page (plan M45): the locked characters,
	 * the setup, the opponent and its game. On a computer it sits on the right beside the table
	 * with the game under it (`frame`, Trevor 2026-11-04: "the game does not open on the right,
	 * which is really what i would want"); on a phone it opens from the bar at the bottom, and
	 * Load game goes to the game.
	 */
	interface Props {
		session: LabSession;
		/** Shows the loaded game in a Storyteller screen under the controls. */
		frame?: boolean;
		/** Its own heading; off inside the phone's dialog, whose title already says it. */
		titled?: boolean;
	}

	let { session, frame = false, titled = true }: Props = $props();

	const setup = $derived(session.setup);
	const name = (id: CharacterId) => session.byId(id)?.name ?? id;

	const placeOptions = OPPONENT_PLACES.map((place) => ({
		value: place,
		label: t(`lab.place.${place}`)
	}));
	const fillerOptions: { value: LabFiller; label: string }[] = [
		{ value: 'all', label: t('lab.filler.all') },
		...OFFICIAL_EDITIONS.map((e) => ({ value: e.id, label: e.name }))
	];

	let screenId = $state(STORYTELLER_SCREENS[0].id);
	const screen = $derived(STORYTELLER_SCREENS.find((s) => s.id === screenId)!);
	const screenOptions = STORYTELLER_SCREENS.map((s) => ({
		value: s.id,
		label: `${s.name} · ${s.width}×${s.height}`
	}));
	let width = $state(0);

	/** The report form's title: the lab, then the pairing shown. */
	const reportName = $derived(
		[
			t('lab.title'),
			[...session.locked, ...(session.current ? [session.current.id] : [])].map(name).join(' + ')
		]
			.filter(Boolean)
			.join(': ')
	);

	let addOpen = $state(false);
	let inspecting = $state<Character>();
	let inspectOpen = $state(false);
	function inspect(id: CharacterId) {
		inspecting = session.byId(id);
		inspectOpen = !!inspecting;
	}
	function add(id: CharacterId) {
		session.setLocked(id, true);
		addOpen = false;
	}
	/** A computer loads the game into the frame; a phone goes to it. */
	const step = (by: -1 | 1) =>
		frame ? void session.load(session.at + by) : session.show(session.at + by);
</script>

<section class="lab" aria-label={t('lab.title')} bind:clientWidth={width} data-testid="lab-panel">
	<div class="head">
		{#if titled}<h2>{t('lab.title')}</h2>{/if}
		<ReportButton name={reportName} />
	</div>

	<!-- Add stays at the top; each locked character on its own line under it, in a list that
	     keeps its height, so nothing below moves (Trevor, 2026-11-04). -->
	<div class="field">
		<h3>{t('lab.locked')}</h3>
		<div class="nav" data-testid="lab-testing">
			<IconButton
				icon="back"
				label={t('lab.previousCharacter')}
				disabled={session.loading || !session.testing}
				onclick={() => void session.stepTesting(-1, !frame)}
			/>
			<span class="position">
				{#if session.testing}<CharacterPiece
						template="badge"
						characterId={session.testing}
					/>{:else}{t('common.none')}{/if}
			</span>
			<IconButton
				icon="forward"
				label={t('lab.nextCharacter')}
				disabled={session.loading || !session.testing}
				onclick={() => void session.stepTesting(1, !frame)}
			/>
		</div>
		<AddRow label={t('lab.add')} onclick={() => (addOpen = true)} />
		<ul class="locked" data-testid="lab-locked">
			{#each session.locked as id (id)}
				<li>
					<span class="grow"><CharacterPiece template="badge" characterId={id} /></span>
					<IconButton
						icon="data"
						label={t('lab.inspect', { character: name(id) })}
						onclick={() => inspect(id)}
					/>
					<DeleteButton
						label={t('lab.remove', { character: name(id) })}
						onclick={() => session.setLocked(id, false)}
					/>
				</li>
			{:else}
				<li class="none">{t('common.none')}</li>
			{/each}
		</ul>
		<!-- Usable once a character is locked; until then the table shows every character. -->
		<Toggle
			label={t('lab.jinxedOnly')}
			checked={setup.jinxedOnly}
			disabled={session.locked.length === 0}
			onChange={(jinxedOnly) => lab.update({ jinxedOnly, index: 0 })}
		/>
	</div>

	<PlayerCountSheet
		players={setup.playerCount}
		onChange={(playerCount) => lab.update({ playerCount })}
		storageKey="lab:sheet"
		testid="lab-players"
	/>
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
		onChange={(filler: LabFiller) => lab.update({ filler })}
	/>
	<!-- Places each game's setup reminders, chosen at random (Trevor, 2026-11-04). -->
	<Toggle
		label={t('lab.setupTokens')}
		checked={setup.setupTokens}
		onChange={(setupTokens) => lab.update({ setupTokens })}
	/>

	<!-- The characters in the table's rows, one at a time, with the jinx text between them and
	     the locked ones (Trevor, 2026-11-04: "rename pairings to jinxes"). -->
	<section class="field" aria-label={t('lab.pairs')}>
		<h3>{t('lab.pairs')}</h3>
		<div class="nav" data-testid="lab-opponent">
			<IconButton
				icon="back"
				label={t('lab.previous')}
				disabled={session.loading || session.at === 0}
				onclick={() => step(-1)}
			/>
			<span class="position">
				{#if session.current}<CharacterPiece
						template="badge"
						characterId={session.current.id}
					/>{:else}{t('common.none')}{/if}
				<span class="count" data-testid="lab-position"
					>{session.opponents.length
						? t('lab.position', { at: session.at + 1, total: session.opponents.length })
						: t('common.none')}</span
				>
			</span>
			<IconButton
				icon="forward"
				label={t('lab.next')}
				disabled={session.loading || session.at >= session.opponents.length - 1}
				onclick={() => step(1)}
			/>
		</div>
		<Button
			variant="accent"
			disabled={session.loading || !session.data}
			onclick={() => void session.load(session.at, !frame)}
			>{session.loading ? t('lab.loading') : t('lab.load')}</Button
		>
		<!-- A set height that scrolls, so a pairing with more jinxes moves nothing below. -->
		<div class="jinx-list" data-testid="lab-jinxes">
			{#each session.pairJinxes as jinx (jinx.characters.join('+'))}
				<JinxNote {jinx} />
			{:else}
				<p class="none">{t('common.none')}</p>
			{/each}
		</div>
	</section>

	{#if frame}
		<div class="row">
			<span class="grow">
				<Select
					label={t('lab.screen')}
					hideLabel
					value={screenId}
					options={screenOptions}
					onChange={(id: string) => (screenId = id)}
				/>
			</span>
			<Button href={session.gamePath} disabled={!session.gamePath}>{t('lab.openGame')}</Button>
		</div>
		{#key `${session.gamePath}:${session.loads}`}
			<DeviceFrame
				device={screen}
				caption={t('lab.storyteller')}
				title={t('lab.storyteller')}
				src={session.gamePath ?? '/'}
				zoom={1}
				room={width}
				testid="lab-frame"
			>
				{#snippet aside()}<span>{LAB_SCRIPT_NAME}</span>{/snippet}
			</DeviceFrame>
		{/key}
	{/if}
</section>

<Dialog bind:open={addOpen} title={t('lab.addTitle')} size="full">
	{#if session.data}
		{@const data = session.data}
		<!-- Quick ways to the characters worth testing (Trevor, 2026-11-04). -->
		<div class="filters">
			<Toggle
				label={t('lab.hasJinxes')}
				checked={setup.pickJinxed}
				onChange={(pickJinxed) => lab.update({ pickJinxed })}
			/>
			<Toggle
				label={t('lab.changesSetup')}
				checked={setup.pickSetup}
				onChange={(pickSetup) => lab.update({ pickSetup })}
			/>
		</div>
		<CharacterPicker
			characters={data.characters}
			selected={session.locked}
			onSelect={add}
			types={CHARACTER_TYPES}
			jinxCounts
			filter={(c) =>
				(!setup.pickJinxed || !!data.jinxes.byCharacter.get(c.id)?.length) &&
				(!setup.pickSetup || c.setup)}
		/>
	{/if}
</Dialog>

{#if inspecting}<CharacterDataDialog bind:open={inspectOpen} character={inspecting} />{/if}

<style>
	.lab {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--space-2);
		min-width: 0;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	h2,
	h3 {
		margin: 0;
	}
	h2 {
		font-size: 1.15rem;
	}
	h3 {
		font-size: 1rem;
	}
	.field {
		display: grid;
		gap: var(--space-1);
	}
	.row,
	.locked li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.nav {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
	}
	.position {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-1) var(--space-2);
		min-width: 0;
		color: var(--on-surface-muted);
	}
	.count {
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}
	/* Each locked character on its own line, in a list that keeps its height. */
	.locked {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		align-content: start;
		gap: var(--space-1);
		height: calc(3 * var(--tap-target) + 2 * var(--space-1));
		overflow-y: auto;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.filters {
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
</style>
