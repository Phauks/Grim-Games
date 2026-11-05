<script lang="ts">
	import { OFFICIAL_EDITIONS } from '#lib/core/data/index.ts';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { LabFiller } from '#lib/core/lab/lab-game.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import JinxNote from '#lib/features/characters/JinxNote.svelte';
	import ReportButton from '#lib/features/reports/ReportButton.svelte';
	import PlayerCountSheet from '#lib/features/setup/PlayerCountSheet.svelte';
	import DeviceFrame from '#lib/features/test-room/DeviceFrame.svelte';
	import { STORYTELLER_SCREENS } from '#lib/features/test-room/devices.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { lab } from './lab-store.svelte.ts';
	import type { LabSession } from './lab-session.svelte.ts';
	import { LAB_SCRIPT_NAME } from './load-lab-game.ts';

	/**
	 * The Character Lab's game and setup on the Characters page (plans M45, M47). On a computer
	 * it sits on the right of the selected characters, the game at the top (Trevor, 2026-11-04:
	 * "put the mock grim at the top of the right side"), its controls on a solid box under it;
	 * on a phone it opens from the bar at the bottom, and Load game goes to the game.
	 */
	interface Props {
		session: LabSession;
		/** Shows the loaded game in a Storyteller screen above the controls. */
		frame?: boolean;
	}

	let { session, frame = false }: Props = $props();

	const setup = $derived(session.setup);
	const name = (id: CharacterId) => session.byId(id)?.name ?? id;

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

	/** A computer loads the game into the frame; a phone goes to it. */
	const step = (by: -1 | 1) =>
		frame ? void session.load(session.at + by) : session.show(session.at + by);
</script>

<section class="lab" aria-label={t('lab.title')} bind:clientWidth={width} data-testid="lab-panel">
	{#if frame}
		{#key `${session.gamePath}:${session.loads}`}
			<DeviceFrame
				device={screen}
				caption={t('lab.storyteller')}
				title={t('lab.storyteller')}
				src={session.gamePath ?? '/'}
				zoom={1}
				room={width}
				square
				testid="lab-frame"
			>
				{#snippet aside()}<span>{LAB_SCRIPT_NAME}</span>{/snippet}
			</DeviceFrame>
		{/key}
	{/if}

	<!-- A solid box, so the page's background never shows through the controls (Trevor,
	     2026-11-04). -->
	<div class="box">
		<!-- The characters in the rows on the left, one at a time, with the jinx text between
		     them and the locked ones (Trevor, 2026-11-04: "rename pairings to jinxes"). -->
		<section class="field" aria-label={t('lab.pairs')}>
			<div class="head">
				<h3>{t('lab.pairs')}</h3>
				<ReportButton name={reportName} />
			</div>
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
			<Select
				label={t('lab.screen')}
				value={screenId}
				options={screenOptions}
				onChange={(id: string) => (screenId = id)}
			/>
		{/if}
		<PlayerCountSheet
			players={setup.playerCount}
			onChange={(playerCount) => lab.update({ playerCount })}
			storageKey="lab:sheet"
			testid="lab-players"
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
	</div>
</section>

<style>
	.lab {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--space-2);
		min-width: 0;
	}
	.box {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-md);
		background: var(--card-background);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	h3 {
		margin: 0;
		font-size: 1rem;
	}
	.field {
		display: grid;
		gap: var(--space-1);
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
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.jinx-list {
		display: grid;
		align-content: start;
		gap: var(--space-2);
		height: calc(9 * var(--u));
		overflow-y: auto;
	}
</style>
