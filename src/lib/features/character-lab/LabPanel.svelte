<script lang="ts">
	import { OFFICIAL_EDITIONS } from '#lib/core/data/index.ts';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { LabFiller } from '#lib/core/lab/lab-game.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import JinxNote from '#lib/features/characters/JinxNote.svelte';
	import ReportButton from '#lib/features/reports/ReportButton.svelte';
	import PlayerCountSheet from '#lib/features/setup/PlayerCountSheet.svelte';
	import { STORYTELLER_SCREENS } from '#lib/features/test-room/devices.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import LabGameFrame from './LabGameFrame.svelte';
	import { lab } from './lab-store.svelte.ts';
	import type { LabSession } from './lab-session.svelte.ts';

	/**
	 * The Character Lab's game and setup on the Characters page (plans M45, M47). On a computer
	 * it sits on the right of the selected characters, the game at the top (Trevor, 2026-11-04:
	 * "put the mock grim at the top of the right side"), its controls on a solid box under it;
	 * on a phone it opens from the bar at the bottom, and Load game shows the game under the
	 * table (Trevor, 2026-11-06: "only to show it beneath").
	 */
	interface Props {
		session: LabSession;
		/** Shows the loaded game in a Storyteller screen above the controls. */
		frame?: boolean;
		/** After Load game, when the game shows elsewhere (a phone's game under the table). */
		onloaded?: () => void;
	}

	let { session, frame = false, onloaded }: Props = $props();

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

	/** First night, then each day: Day 1 to Day 3. */
	const startOptions = [0, 1, 2, 3].map((day) => ({
		value: String(day),
		label: day === 0 ? t('lab.startOn.night') : t('lab.startOn.day', { day })
	}));

	/** The report form's title: the lab, then the pairing shown. */
	const reportName = $derived(
		[
			t('lab.title'),
			[session.core, session.current?.id]
				.filter((id): id is CharacterId => !!id)
				.map(name)
				.join(' + ')
		]
			.filter(Boolean)
			.join(': ')
	);

	/** A computer loads the game into the frame; a phone loads it with Load game. */
	const step = (by: -1 | 1) =>
		frame ? void session.load(session.at + by) : session.show(session.at + by);
</script>

<section class="lab" aria-label={t('lab.title')} bind:clientWidth={width} data-testid="lab-panel">
	{#if frame}
		<!-- Pinned at the top right while the settings and partners scroll under it (Trevor,
		     2026-11-05: "pin mock game on the top right"). -->
		<div class="pinned">
			<LabGameFrame {session} device={screen} room={width} />
		</div>
	{/if}

	<!-- The game's settings first, so they always sit in the same place (Trevor, 2026-11-05:
	     "move all settings relate to the mock grim above"), on solid boxes so the page's
	     background never shows through (Trevor, 2026-11-04). -->
	<div class="box" data-testid="lab-settings">
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
		<!-- Where the game opens (Trevor, 2026-11-05: "what day of the game to start on"). -->
		<Select
			label={t('lab.startOn')}
			value={String(setup.startDay)}
			options={startOptions}
			onChange={(day: string) => lab.update({ startDay: Number(day) })}
		/>
	</div>
	<div class="box">
		<!-- The core character's jinx partners, and only those (Trevor, 2026-11-05: "jinxed with
		     locked should be on the right side with jinxed characters ... only show jinxed
		     characters"), one at a time with the jinx text between them. -->
		<section class="field" aria-label={t('lab.pairs')}>
			<div class="head">
				<h3>{t('lab.pairs')}</h3>
				<ReportButton name={reportName} />
			</div>
			<!-- A set height that scrolls, so a character with more partners moves nothing below. -->
			<div class="partners" data-testid="lab-partners">
				{#each session.opponents as opponent, i (opponent.id)}
					<Chip
						pressed={i === session.at}
						disabled={session.loading}
						onclick={() => (frame ? void session.load(i) : session.show(i))}
						><CharacterPiece template="badge" characterId={opponent.id} interactive={false} /></Chip
					>
				{:else}
					<p class="none">{t('common.none')}</p>
				{/each}
			</div>
			<div class="nav" data-testid="lab-opponent">
				<IconButton
					icon="back"
					label={t('lab.previous')}
					disabled={session.loading || session.at === 0}
					onclick={() => step(-1)}
				/>
				<span class="position">
					<!-- With no partner, the list above says None once (Trevor, 2026-11-05). -->
					{#if session.current}<CharacterPiece
							template="badge"
							characterId={session.current.id}
						/>{/if}
					<span class="count" data-testid="lab-position"
						>{session.opponents.length
							? t('lab.position', { at: session.at + 1, total: session.opponents.length })
							: ''}</span
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
				onclick={() => void session.load(session.at).then(() => onloaded?.())}
				>{session.loading ? t('lab.loading') : t('lab.load')}</Button
			>
			<!-- A set height that scrolls, so a pairing with more jinxes moves nothing below. -->
			<div class="jinx-list" data-testid="lab-jinxes">
				{#each session.pairJinxes as jinx (jinx.characters.join('+'))}
					<JinxNote {jinx} />
				{/each}
			</div>
		</section>
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
	.pinned {
		position: sticky;
		top: 0;
		z-index: 2;
		padding-bottom: var(--space-2);
		margin-bottom: calc(-1 * var(--space-2));
		/* The page's own backdrop, held still, so the pinned frame shows no edge. */
		background: var(--pin-background);
		background-attachment: fixed;
	}
	.box {
		/* A pinned section header inside (Setup sheet) fills with the box's own colour. */
		--pin-background: var(--card-background);
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
	.partners {
		display: flex;
		flex-wrap: wrap;
		align-content: start;
		gap: var(--space-1);
		height: calc(2 * var(--tap-target) + var(--space-1));
		overflow-y: auto;
	}
	.jinx-list {
		display: grid;
		align-content: start;
		gap: var(--space-2);
		height: calc(9 * var(--u));
		overflow-y: auto;
	}
</style>
