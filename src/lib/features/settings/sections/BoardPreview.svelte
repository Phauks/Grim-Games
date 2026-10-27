<script lang="ts">
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import { onMount } from 'svelte';
	import { innerHeight, innerWidth } from 'svelte/reactivity/window';
	import type { Alignment, CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
	import exampleLogo from '#lib/assets/example-script-logo.svg';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import type { BackgroundChoice } from '#lib/features/grimoire/backgrounds.ts';
	import BoardBackdrop from '#lib/features/grimoire/BoardBackdrop.svelte';
	import { boardBackground } from '#lib/features/grimoire/board-background.svelte.ts';
	import { boardLooks } from '#lib/features/grimoire/board-looks.svelte.ts';
	import { storytellerName } from '#lib/features/game/storyteller-name.svelte.ts';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import { defaultBackground } from '#lib/features/grimoire/default-background.svelte.ts';
	import ReminderCount from '#lib/features/grimoire/ReminderCount.svelte';
	import { stepFocus } from '#lib/features/grimoire/step-focus.svelte.ts';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SeatDisc from '#lib/ui/seating/SeatDisc.svelte';
	import { boardTokenSize } from '#lib/ui/seating/last-board.svelte.ts';
	import { seatFrame } from '#lib/core/frames/index.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import { GAME_MODES, SPECIAL_RULES, STANDARD } from '#lib/core/modes/index.ts';
	import { standardPlayersLine } from '#lib/features/modes/players-line.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * A small board for every Board setting (Trevor, 2026-10-20: "you can't really see changes
	 * until you leave"; 2026-10-22: "all preview settings should populate in the preview
	 * area"): the background with its vignette and the script's logo, two seats (one dead with
	 * a used ghost vote) and a reminder, a Fabled and a Loric, the script's name in the corner,
	 * and a reminder bank with a duplicate reminder and the Washerwoman's step in focus. The
	 * open board's own background, logo and name when Settings is opened from a board.
	 */
	onMount(() => void loadOfficialData());
	const SEATS = [
		{ id: 'godfather', name: t('characters.previewPlayer'), dead: false },
		{ id: 'washerwoman', name: t('settings.previewDeadPlayer'), dead: true }
	] as const;
	const RULES = ['duchess', 'bootlegger'] as const;
	/** The walked-through night step whose reminders the bank brings into focus. */
	const STEP: CharacterId = 'washerwoman';
	const SAMPLE_CODE = formatRoomCode('482913');

	const characters = $derived(officialData.current?.byId);
	const character = (id: string) => characters?.get(id);
	const label = (id: string, i: number) => character(id)?.reminders[i];

	const choice: BackgroundChoice = $derived(
		boardBackground.context?.current ?? defaultBackground.current ?? { kind: 'none' }
	);
	let url = $state<string | undefined>();
	$effect(() => {
		if (choice.kind === 'image') {
			const objectUrl = URL.createObjectURL(choice.image);
			url = objectUrl;
			return () => URL.revokeObjectURL(objectUrl);
		}
		url = choice.kind === 'script' ? boardBackground.context?.scriptImage : undefined;
	});
	const logo = $derived(boardBackground.context?.scriptLogo ?? exampleLogo);
	const scriptName = $derived(boardBackground.context?.scriptName ?? t('settings.previewScript'));

	interface BankItem {
		key: string;
		characterId: CharacterId;
		reminder: number;
		alignment: Alignment;
		count: number;
	}
	/** The bank as ReminderBank builds it: duplicates stacked, the step's reminders in focus. */
	const bank = $derived.by(() => {
		const stack = preferences.current.assistance.stackReminders;
		const duchess = (n: number): BankItem => ({
			key: `duchess-${n}`,
			characterId: 'duchess',
			reminder: 0,
			alignment: 'good',
			count: stack ? 2 : 1
		});
		const items: BankItem[] = [
			{ key: 'godfather', characterId: 'godfather', reminder: 0, alignment: 'evil', count: 1 },
			...(stack ? [duchess(0)] : [duchess(0), duchess(1)]),
			{ key: 'ww-0', characterId: STEP, reminder: 0, alignment: 'good', count: 1 },
			{ key: 'ww-1', characterId: STEP, reminder: 1, alignment: 'good', count: 1 }
		];
		const mode = stepFocus.current.mode;
		if (mode === 'only') return items.filter((i) => i.characterId === STEP);
		if (mode === 'front')
			return items.sort((a, b) => Number(b.characterId === STEP) - Number(a.characterId === STEP));
		return items;
	});
	const dimRest = $derived(stepFocus.current.mode === 'highlight');

	// The board's own token size at 100% (Character token size is set in Tokens), small
	// enough for both seats to fit the box's width.
	const viewport = $derived({ width: innerWidth.current ?? 0, height: innerHeight.current ?? 0 });
	let width = $state(0);
	// On a phone the box is at most 30% of the screen's height (SettingGroup): the seats,
	// the middle and the bank (about 3.4 tokens tall with padding) fit inside it.
	const size = $derived(
		Math.min(
			64,
			boardTokenSize(1, viewport),
			width ? Math.floor(width / 4.5) : 64,
			viewport.height ? Math.floor((0.3 * viewport.height - 32) / 3.4) : 64
		)
	);
	// The board's reminder size for this token: half of it, kept between 30 and 48px.
	const chip = $derived(Math.round(Math.max(30, Math.min(48, size * 0.5))));
	const storyteller = $derived(storytellerName.current.trim() || t('settings.previewStoryteller'));
	/**
	 * Sample lines for the rest of the corner: the app's own mode and special rule with the
	 * shortest names, so both fit the preview's one mode line.
	 */
	const shortest = (names: string[]) =>
		names.reduce<string | undefined>(
			(a, b) => (a === undefined || b.length < a.length ? b : a),
			undefined
		);
	const SAMPLE_MODE = shortest(GAME_MODES.filter((m) => m.id !== STANDARD.id).map((m) => m.name));
	const SAMPLE_RULE = shortest(SPECIAL_RULES.map((r) => r.name));
	const SAMPLE_PLAYERS = standardPlayersLine(8);
	/** The corner's lines, as their eyes in Game info and Settings choose. */
	const lines = $derived(preferences.current.cornerLines);
	const modeLine = $derived(
		[
			...(lines.mode && SAMPLE_MODE ? [SAMPLE_MODE] : []),
			...(lines.rules && SAMPLE_RULE ? [SAMPLE_RULE] : [])
		].join(' + ')
	);
	const loose = $derived(boardLooks.current.reminders === 'free');
	const rulesSize = $derived(
		boardLooks.current.rulesAt === 'middle' ? Math.round(size * 0.6) : Math.round(size * 0.4)
	);
</script>

{#snippet reminder(id: CharacterId, i: number, alignment: Alignment)}
	{@const words = label(id, i)}
	{#if words}<BoardReminder
			label={words as ReminderLabel}
			character={character(id)}
			{alignment}
			size={chip}
			disabled
			onTap={() => {}}
		/>{/if}
{/snippet}

{#snippet rules()}
	{#if boardLooks.current.rulesGrouped}
		<span class="preview-rules-stack" data-testid="preview-rules-stack">
			{#each RULES as id (id)}
				{@const rule = character(id)}
				{#if rule}<CharacterToken character={rule} size={rulesSize} />{/if}
			{/each}
			<span class="preview-stack-count" aria-hidden="true"
				><CountBadge count={RULES.length} warn /></span
			>
		</span>
	{:else}
		<ul class="preview-rules" data-testid="preview-rules">
			{#each RULES as id (id)}
				{@const rule = character(id)}
				{#if rule}<li><CharacterToken character={rule} size={rulesSize} /></li>{/if}
			{/each}
		</ul>
	{/if}
{/snippet}

<div
	class="board-preview"
	bind:clientWidth={width}
	style:--size="{size}px"
	style:--chip="{chip}px"
	style:--name-scale={boardLooks.current.nameSize}
	style:--name-offset={boardLooks.current.nameOffset}
	data-rules-at={boardLooks.current.rulesAt}
>
	<BoardBackdrop
		contained
		{url}
		preset={choice.kind === 'preset' ? choice.id : undefined}
		vignette={boardLooks.current.vignette ? boardLooks.current.vignetteStrength : undefined}
	/>
	{#if boardLooks.current.logo}
		<ScriptLogo src={logo} class="preview-logo" --logo-opacity={boardLooks.current.logoOpacity} />
	{/if}
	{#if boardLooks.current.rulesAt === 'edge'}<div class="preview-rules-edge">
			{@render rules()}
		</div>{/if}

	<div class="seats">
		{#each SEATS as seat, i (seat.id)}
			{@const token = character(seat.id)}
			<div class="seat">
				<SeatDisc
					{size}
					name={seat.name}
					number={i + 1}
					dead={seat.dead}
					vote={seat.dead ? 'used' : undefined}
					usedVote={boardLooks.current.usedGhostVote}
					frame={seatFrame(undefined, boardLooks.current.defaultFrame)}
				>
					{#snippet face()}{#if token}<CharacterToken character={token} {size} />{/if}{/snippet}
				</SeatDisc>
				<!-- The Washerwoman's "Townsfolk" on Sam: beside the seat, or where it was dropped. -->
				{#if i === 0}<span class="seat-reminder" class:loose data-testid="preview-seat-reminder"
						>{@render reminder(STEP, 0, 'good')}</span
					>{/if}
			</div>
		{/each}
	</div>
	<div class="preview-middle">
		{#if boardLooks.current.rulesAt === 'middle'}{@render rules()}{/if}
	</div>

	<p class="preview-title" data-testid="preview-script-title">
		<!-- Who watches, before the name here (above it on the board); a sample count. -->
		{#if lines.watchers}<span class="preview-watchers" data-testid="preview-watchers"
				><Icon name="watchers" /><span>2</span></span
			>{/if}{scriptName}
		<!-- The mode and rules take the author's line, joined as on a board short of room. -->
		{#if modeLine}<span class="preview-mode" data-testid="preview-mode">{modeLine}</span>{/if}
		{#if lines.author && !modeLine}<span class="preview-room-code" data-testid="preview-author"
				>{t('player.byAuthor', { author: t('settings.previewAuthor') })}</span
			>{/if}
		{#if lines.version}<span class="preview-room-code" data-testid="preview-version"
				>{t('modes.info.version')}: 1.0</span
			>{/if}
		{#if lines.players}<span class="preview-room-code" data-testid="preview-players"
				>{t('modes.info.players')}: {SAMPLE_PLAYERS}</span
			>{/if}
		<!-- Who runs the game, as on the board (Trevor, 2026-10-23): this device's name. -->
		{#if lines.storyteller}<span class="preview-room-code" data-testid="preview-storyteller"
				>{t('settings.storytellerLine', { name: storyteller })}</span
			>{/if}
		<!-- The join code under the name, as on the board; a sample code here. -->
		{#if lines['join-code']}<span class="preview-room-code" data-testid="preview-room-code"
				>{t('room.joinCode')} <span class="code">{SAMPLE_CODE}</span></span
			>{/if}
		<!-- Day or night and Game time, each its own line under its own eye as on the board;
		     sample ones here. -->
		{#if lines.phase}<span class="preview-room-code" data-testid="preview-phase"
				>{t('day.nightNumber', { number: 2 })}</span
			>{/if}
		{#if lines['game-time']}<span class="preview-room-code" data-testid="preview-game-clock"
				>{t('history.gameLength')} <span class="code">1:23:45</span></span
			>{/if}
	</p>
	<ul class="bank" aria-label={t('settings.previewBank')} data-testid="preview-bank">
		{#each bank as item (item.key)}
			{@const now = item.characterId === STEP}
			<li class:now class:dim={dimRest && !now}>
				{#if item.count > 1}<ReminderCount count={item.count} />{/if}
				{@render reminder(item.characterId, item.reminder, item.alignment)}
			</li>
		{/each}
	</ul>
</div>

<style>
	/* Fixed height: seats with their names at the largest Player name size and distance, the
	   middle, and the bank, so no setting moves the rows below. */
	.board-preview {
		position: relative;
		isolation: isolate;
		display: grid;
		grid-template-rows: calc(1.5 * var(--size)) 1fr calc(1.9 * var(--chip));
		height: calc(2.3 * var(--size) + 1.9 * var(--chip));
		padding-top: calc(0.15 * var(--size));
		overflow: hidden;
		border-radius: var(--card-radius);
	}
	/* As on the board: centred, at most 42% of the box, under everything else. */
	.board-preview :global(.preview-logo) {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 42%;
		height: 42%;
		translate: -50% -50%;
		opacity: var(--logo-opacity);
		pointer-events: none;
	}
	.seats {
		display: flex;
		justify-content: center;
		gap: var(--space-2);
	}
	.seat {
		position: relative;
	}
	/* Held by the seat: tucked against its token's right. Dropped: off on its own. */
	.seat-reminder {
		position: absolute;
		left: 100%;
		top: 0;
	}
	.seat-reminder.loose {
		left: 115%;
		top: 70%;
	}
	.preview-middle {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.preview-rules-edge {
		position: absolute;
		top: var(--space-1);
		left: var(--space-1);
		z-index: 2;
	}
	.preview-rules {
		display: flex;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.preview-rules-stack {
		position: relative;
		display: flex;
	}
	.preview-rules-stack > :global(*:not(:first-child):not(.preview-stack-count)) {
		margin-inline-start: -60%;
	}
	.preview-stack-count {
		position: absolute;
		right: 0;
		bottom: 0;
		display: flex;
		font-size: 0.75rem;
	}
	.preview-title {
		position: absolute;
		left: var(--space-1);
		bottom: calc(1.9 * var(--chip));
		z-index: 1;
		max-width: 40%;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-heading);
		/* Sized to the preview's tokens, so every corner line fits beside the seats. */
		font-size: calc(0.24 * var(--size));
		line-height: 1.15;
		color: var(--heading);
	}
	.preview-mode {
		display: block;
		font-family: var(--font-control);
		font-size: 0.75em;
		font-variant: small-caps;
		letter-spacing: 0.08em;
		color: var(--accent);
	}
	.preview-watchers {
		--icon-size: 1em;
		display: inline-flex;
		margin-inline-end: var(--space-1);
		align-items: center;
		gap: var(--space-1);
		font-family: var(--font-control);
		font-size: 0.75em;
		color: var(--on-surface-muted);
	}
	.preview-room-code {
		display: block;
		font-family: var(--font-control);
		font-size: 0.75em;
		color: var(--on-surface-muted);
	}
	.preview-room-code .code {
		color: var(--on-surface);
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.08em;
	}
	/* The board's bank (ReminderBank .bank): its outline, corners and see-through bar, so the
	   preview's bank reads as the board's (Trevor, 2026-10-23: "doesn't look like it has an
	   outline"). e2e/settings.e2e.ts checks the two stay alike. */
	.bank {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		margin: 0 var(--space-1) var(--space-1);
		padding: 0 var(--space-1);
		overflow: hidden;
		list-style: none;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--board-bar-background);
	}
	.bank > li {
		position: relative;
		flex: none;
	}
	.bank > li.now > :global(.reminder) {
		outline: var(--reminder-lit-ring, 0.2rem solid var(--accent));
		outline-offset: 0.15rem;
		filter: var(--reminder-lit-glow, none);
	}
	.bank > li.dim {
		opacity: 0.4;
	}
</style>
