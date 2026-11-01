<script lang="ts">
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import StepIcon from './StepIcon.svelte';
	import NightAlerts from './NightAlerts.svelte';
	import StepAfflictions from './StepAfflictions.svelte';
	import ChangeCharacterStep from './ChangeCharacterStep.svelte';
	import StorytellerAbilityStep from './StorytellerAbilityStep.svelte';
	import CountdownStep from './CountdownStep.svelte';
	import NightSuggested from './NightSuggested.svelte';
	import NightShownTo from './NightShownTo.svelte';
	import NightYesNo from './NightYesNo.svelte';
	import TravellerAlignment from './TravellerAlignment.svelte';
	import { STANDARD_INFO_TOKENS, type CharacterId } from '#lib/core/data/index.ts';
	import { believesDemon, TRAVELLER_ALIGNMENT_STEP } from '#lib/core/rules/index.ts';
	import { seesGrimoire } from '#lib/core/rules/sees-grimoire.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import type { InfoChoice, InfoPicker, Night, NightStep } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import EvilInfoCards from '#lib/features/show/EvilInfoCards.svelte';
	import StepInfoTokens from '#lib/features/info-tokens/StepInfoTokens.svelte';
	import { withChosen, type FilledInfoToken } from '#lib/core/rules/info-token-characters.ts';
	import { trueCharacter } from '#lib/core/model/index.ts';
	import type { InfoToken } from '#lib/core/data/info-tokens.ts';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import type { ShownInfoCard } from '#lib/features/show/shown.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import { placingAlignment, seatMisfits } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { givesNumber, seatName, stepHolders, stepName } from './night-steps.ts';
	import { reminderCopies, reminderKey } from './reminders.ts';
	import SeatChooser from './SeatChooser.svelte';
	import ReminderMoveConfirm from './ReminderMoveConfirm.svelte';
	import { shownCommands } from './record-shown.ts';

	/**
	 * One night step, filled in with help (Trevor, 2026-10-16): TPI's text, who has the
	 * character, its reminders to place or move onto a chosen seat, and Show to player.
	 * Nothing happens unless the Storyteller taps it; Done ticks the step.
	 */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
		step: NightStep | undefined;
		night: Night;
		/**
		 * Info tokens, for the steps that show the player something; with a token, opened
		 * straight at that card (one the step's text names, Trevor 2026-10-19), with the
		 * characters the step's rules fill in.
		 */
		onInfoTokens: (token?: InfoToken, filled?: FilledInfoToken) => void;
		/** Demon info with no bluffs yet: open the Demon bluffs sheet. */
		onChooseBluffs?: () => void;
		/** A Traveller's alignment by draw. */
		onDraw: (seatId: string) => void;
		/** Tonight's steps, to move to the one before or after without ticking anything. */
		steps?: readonly NightStep[];
		onStep?: (step: NightStep) => void;
		/** A player who looks at the Grimoire (the Spy, the Widow): the board, shown clean. */
		onShowGrimoire?: () => void;
	}

	let {
		open = $bindable(),
		grimoire,
		step,
		night,
		onInfoTokens,
		onChooseBluffs,
		onDraw,
		steps = [],
		onStep,
		onShowGrimoire
	}: Props = $props();

	const returnLabel = (label: string) => `Return ${label} to the reminder bank`;

	// Previous and Next inside the step, by icon or a sideways swipe (Trevor, 2026-10-17).
	const index = $derived(step ? steps.findIndex((s) => s.id === step.id) : -1);
	function go(by: number) {
		const next = steps[index + by];
		if (index >= 0 && next) onStep?.(next);
	}
	let swipeFrom: { x: number; y: number; id: number } | undefined;
	function swipeStart(event: PointerEvent) {
		if (event.pointerType !== 'mouse')
			swipeFrom = { x: event.clientX, y: event.clientY, id: event.pointerId };
	}
	function swipeEnd(event: PointerEvent) {
		const from = swipeFrom;
		swipeFrom = undefined;
		if (!from || from.id !== event.pointerId) return;
		const dx = event.clientX - from.x;
		const dy = event.clientY - from.y;
		// A clear sideways swipe: a fifth of the screen, mostly across.
		if (Math.abs(dx) > window.innerWidth / 5 && Math.abs(dx) > 2 * Math.abs(dy))
			go(dx < 0 ? 1 : -1);
	}

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const holders = $derived(step ? stepHolders(game, step, characters) : []);
	const believers = $derived(holders.filter((s) => believesDemon(game, s, characters)));
	/**
	 * The character's own reminder tokens, one row per copy the game has (the Mathematician's
	 * five "Abnormal", Trevor 2026-10-17), each placed or moved on its own.
	 */
	const total = $derived(reminderCopies(game, characters, grimoire.copies, grimoire.bankCopies));
	const rows = $derived.by(() => {
		const character = step?.character;
		if (!character) return [];
		return [...new Set(character.reminders)].flatMap((label) => {
			const on = placedAll(label);
			const n = Math.max(
				total.get(reminderKey({ characterId: character.id, label })) ?? 1,
				on.length
			);
			return Array.from({ length: n }, (_, i) => ({
				label,
				at: on[i],
				// eslint-disable-next-line grim/names-as-badges -- an identity key, never shown
				key: `${label}:${i}`
			}));
		});
	});
	/** Where each copy of a label is on the board, in seating order. */
	function placedAll(label: string) {
		return game.seating.flatMap((seatId) =>
			game.seats[seatId].reminders
				.filter((x) => x.characterId === step?.character?.id && x.label === label)
				.map((r) => ({ seatId, reminderId: r.reminderId }))
		);
	}

	let moveConfirm = $state<ReturnType<typeof ReminderMoveConfirm>>();
	let choosing = $state<{ label: string; at?: { reminderId: string } } | undefined>();
	let chooserOpen = $state(false);

	/**
	 * A card that shows the true character of a player the Storyteller taps first (the
	 * Dreamer's, Trevor 2026-10-24): which player is asked here, then the card opens.
	 */
	let asking = $state<{ token: InfoToken; filled: FilledInfoToken } | undefined>();
	let askOpen = $state(false);
	// eslint-disable-next-line grim/names-as-badges -- the dialog's spoken name; its heading shows the badge
	const askTitle = $derived(`${step?.character?.name ?? ''} chose`);
	function chooseCard(token: InfoToken, filled?: FilledInfoToken) {
		if (filled?.chosenAt === undefined) return onInfoTokens(token, filled);
		asking = { token, filled };
		askOpen = true;
	}
	function chosen(seatId: SeatId) {
		askOpen = false;
		const ask = asking;
		const id = trueCharacter(game, seatId, characters);
		const character = id ? characters.get(id) : undefined;
		if (!ask) return;
		onInfoTokens(ask.token, character ? withChosen(ask.filled, character) : ask.filled);
	}
	/**
	 * The seats the token being put doesn't fit, faded in the list (Trevor, 2026-10-27: only
	 * valid picks, e.g. only Minions for the Preacher).
	 */
	const misfits = $derived.by(() => {
		const id = step?.character?.id;
		if (!choosing || !id) return undefined;
		return seatMisfits(
			game,
			{ characterId: id, label: choosing.label },
			characters,
			grimoire.atDawn
		);
	});
	function choose(label: string, at?: { reminderId: string }) {
		choosing = { label, at };
		chooserOpen = true;
	}
	function put(seatId: SeatId) {
		chooserOpen = false;
		const picked = choosing;
		choosing = undefined;
		const id = step?.character?.id;
		if (!picked || !id) return;
		if (picked.at) moveConfirm?.request(picked.at.reminderId, seatId);
		else
			grimoire.run({
				type: 'AddReminder',
				seatId,
				reminder: { characterId: id, label: picked.label }
			});
	}

	let showOpen = $state(false);
	/** Shown: the step's character, or a suggested answer's (the Undertaker's). */
	let shownId = $state<CharacterId | undefined>();
	/** A card from Minion info or Demon info, shown instead of the step's character. */
	let shownCard = $state<ShownInfoCard | undefined>();
	const shownCharacter = $derived(
		shownId ? characters.get(shownId) : (step?.character ?? undefined)
	);

	/**
	 * A step that gives a number offers the "Your number is" info token (Trevor, 2026-10-18),
	 * starting at the suggested number when the game knows one.
	 */
	const numberCard = STANDARD_INFO_TOKENS.find((t) => t.id === 'number')?.text ?? '';
	const numberStep = $derived(!!step && givesNumber(step));
	let number = $state(0);
	$effect.pre(() => {
		const answer = step?.info?.kind === 'answer' ? step.info.answers[0] : undefined;
		number = answer?.kind === 'number' ? answer.value : 0;
	});
	/** A row of Valid Information shown to the player is recorded (`record-shown.ts`). */
	function record(picker: InfoPicker, choice: InfoChoice) {
		if (grimoire.open.viewOnly) return;
		for (const command of shownCommands(game, characters, picker, choice)) grimoire.run(command);
	}
	function showNumber(n: number) {
		// Over the open step, as with a suggestion's Show to player.
		shownId = undefined;
		shownCard = { title: numberCard, detail: String(n) };
		showOpen = true;
	}
</script>

<Dialog bind:open title={step ? stepName(step) : 'Night step'} size="full">
	{#snippet headActions()}
		{#if steps.length > 0}
			<IconButton icon="back" label="Previous step" disabled={index <= 0} onclick={() => go(-1)} />
			<IconButton
				icon="forward"
				label="Next step"
				disabled={index < 0 || index >= steps.length - 1}
				onclick={() => go(1)}
			/>
		{/if}
		<!-- Beside the X, which closes the step: no Done (Trevor, 2026-10-20). Both open over
		     the step, which stays open under them. -->
		<IconButton icon="info" label="Info tokens" onclick={() => onInfoTokens()} />
		<IconButton
			icon="showToPlayer"
			label="Show to player"
			disabled={!step?.character}
			onclick={() => {
				shownCard = undefined;
				shownId = undefined;
				showOpen = true;
			}}
		/>
	{/snippet}
	<!-- The step scrolls on its own under its header. -->
	<div
		class="scroll"
		role="group"
		aria-label="Night step"
		onpointerdown={swipeStart}
		onpointerup={swipeEnd}
		onpointercancel={() => (swipeFrom = undefined)}
	>
		{#if step}
			<div class="head">
				<span class="icon">
					<StepIcon {step} size={56} details />
				</span>
				<div class="head-text">
					<!-- An ability the Storyteller holds wakes nobody: the Storyteller acts. -->
					<p class="who" data-testid="step-who">
						{#if step.storytellerAbility}Storyteller{:else}{#each holders as s, i (s)}{i > 0
									? ', '
									: ''}<PlayerBadge name={seatName(game, s)} />{:else}None{/each}{/if}
					</p>
					<!-- The whole ability up top, beside the icon and name (Trevor, 2026-10-17). -->
					{#if step.character?.ability}
						<p class="ability" data-testid="step-ability">
							<GlossaryText text={step.character.ability} names={[step.character.name]} />
						</p>
					{/if}
				</div>
			</div>
			<!-- What to do comes before any information (Trevor, 2026-10-20). -->
			{#if step.reminder}
				<p class="text">
					{#if step.character}
						<NightText text={step.reminder} character={step.character} {night} />
					{:else}
						{step.reminder}
					{/if}
				</p>
			{/if}
			<!-- The board itself, for as long as they need (Trevor, 2026-10-30); the step closes
			     under it and comes back with its X. -->
			{#if step.character && onShowGrimoire && seesGrimoire(step.character)}
				<Button
					variant="quiet"
					icon="showToPlayer"
					onclick={() => {
						open = false;
						onShowGrimoire();
					}}>Show the Grimoire</Button
				>
			{/if}
			<NightAlerts {grimoire} {step} withoutImpaired />
			{#if step.id === TRAVELLER_ALIGNMENT_STEP}
				<TravellerAlignment
					{grimoire}
					travellers={step.travellers ?? []}
					onDraw={(seatId) => {
						open = false;
						onDraw(seatId);
					}}
				/>
			{/if}
			<NightSuggested
				{grimoire}
				{step}
				onShowNumber={numberStep ? showNumber : undefined}
				onRecord={record}
				onShow={(id) => {
					// Over the open step: closing the step in the same update threw inside the
					// dialog library (an effect scheduled outside a batch, from the Undertaker's
					// suggestion opened from the walk-through).
					shownCard = undefined;
					shownId = id;
					showOpen = true;
				}}
				onShowCharacters={(set) => {
					// Every token on one card, as the Godfather is shown its Outsiders; with none,
					// the card says so ("No Outsiders", Trevor 2026-10-28).
					shownId = undefined;
					shownCard =
						set.value.length === 0
							? { title: `No ${TYPE_PLURALS[set.type]}` }
							: {
									characters: set.value.flatMap((id) => {
										const character = characters.get(id);
										return character ? [{ character }] : [];
									})
								};
					showOpen = true;
				}}
			/>
			<NightShownTo
				{grimoire}
				{step}
				onShow={(id) => {
					shownCard = undefined;
					shownId = id;
					showOpen = true;
				}}
				onShowCard={(card) => {
					shownId = undefined;
					shownCard = card;
					showOpen = true;
				}}
			/>
			<NightYesNo
				{grimoire}
				{step}
				onShowAnswer={(answer) => {
					// The Yes/No info token, only its answer, as the Info tokens sheet shows it.
					shownId = undefined;
					shownCard = { detail: answer };
					showOpen = true;
				}}
				onRecord={record}
			/>
			{#if step.character}
				<!-- Over the open step, as with a suggestion's Show to player. -->
				<ChangeCharacterStep
					{grimoire}
					{step}
					onShow={(id) => {
						shownCard = undefined;
						shownId = id;
						showOpen = true;
					}}
				/>
				<StorytellerAbilityStep {grimoire} {step} />
				<!-- The Courtier's Drunk 3, 2, 1: counted down on other nights, as its text says. -->
				{#if night === 'other'}<CountdownStep {grimoire} {step} />{/if}
			{/if}
			{#if numberStep}
				<h3>Info token</h3>
				<div class="number" data-testid="step-number">
					<span class="card-text" aria-hidden="true">{numberCard}</span>
					<NumberSelect
						bind:value={number}
						label={numberCard}
						hideLabel
						min={0}
						max={Math.max(game.seating.length, 1)}
					/>
					<Button variant="quiet" onclick={() => showNumber(number)}>Show to player</Button>
				</div>
			{/if}
			<!-- Every card Minion info or Demon info can show (Trevor, 2026-10-18). -->
			{#if step.id === 'minioninfo' || step.id === 'demoninfo'}
				<EvilInfoCards
					{game}
					{characters}
					step={step.id}
					onShow={(card) => {
						// Over the open step, as with a suggestion's Show to player: closing it here showed
						// the board for a moment when the player view closed (Trevor, 2026-10-26).
						shownId = undefined;
						shownCard = card;
						showOpen = true;
					}}
					onChooseBluffs={() => {
						open = false;
						onChooseBluffs?.();
					}}
				/>
			{/if}
			<!-- A player who believes they are the Demon is shown a fake world (Trevor, 2026-10-29). -->
			{#each believers as seatId (seatId)}
				<EvilInfoCards
					{game}
					{characters}
					step="believer"
					believer={seatId}
					{night}
					onShow={(card) => {
						shownId = undefined;
						shownCard = card;
						showOpen = true;
					}}
					onChooseBluffs={() => {
						open = false;
						onChooseBluffs?.();
					}}
					onFakeChange={(info) => grimoire.run({ type: 'SetFakeEvilInfo', seatId, info })}
				/>
			{/each}
			<!-- The info tokens the text names, ready to show (Trevor, 2026-10-19). -->
			{#if step.character}
				<!-- Over the open step, which stays open under the sheet, as with onShow above. -->
				<StepInfoTokens
					text={step.reminder}
					character={step.character}
					{characters}
					prepValues={game.prepValues}
					onchoose={chooseCard}
				/>
			{/if}
			<!-- Who is drunk or poisoned, as its own section (Trevor, 2026-10-17). -->
			{#if step.character}
				<StepAfflictions {grimoire} {step} />
			{/if}
			{#if rows.length > 0}
				<h3>Reminders</h3>
				<ul class="reminders">
					{#each rows as { label, at, key } (key)}
						{@const held = at ? game.seats[at.seatId] : undefined}
						<li>
							<!-- The token itself, as on the board (Trevor, 2026-10-30). -->
							<BoardReminder
								{label}
								character={step.character}
								alignment={step.character
									? placingAlignment(game, step.character.id, characters)
									: undefined}
							/>
							<!-- The seat and its character (Trevor, 2026-10-18), on one line. -->
							<span class="where"
								>{#if at}On <PlayerBadge name={seatName(game, at.seatId)} />{:else}Not placed{/if}{#if held?.characterId}
									<CharacterBadge
										characterId={held.characterId}
										character={characters.get(held.characterId)}
										alignment={held.alignment}
									/>{/if}</span
							>
							<Button variant="quiet" onclick={() => choose(label, at)}
								>{at ? 'Move' : 'Place'}</Button
							>
							<!-- Off the board and back to the reminder bank, from the step (Trevor,
							     2026-10-17); there but unusable while not placed. -->
							<DeleteButton
								label={returnLabel(label)}
								disabled={!at}
								onclick={() => at && moveConfirm?.requestReturn(at.reminderId)}
							/>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</div>
	<!--
		Inside the step, which stays open under it, so closing it goes straight back to the step
		with nothing in between (Trevor, 2026-10-26), and the step's modal never hides it from
		screen readers.
	-->
	<ShowToPlayer
		bind:open={showOpen}
		characters={shownCharacter ? [{ character: shownCharacter }] : []}
		cards={shownCard && [shownCard]}
	/>
</Dialog>

<SeatChooser
	bind:open={chooserOpen}
	title={choosing ? `Put ${choosing.label} on` : 'Put on'}
	{game}
	{characters}
	{misfits}
	onChoose={put}
/>

<SeatChooser bind:open={askOpen} title={askTitle} {game} {characters} onChoose={chosen}>
	{#snippet heading()}
		{#if step?.character}<CharacterBadge
				characterId={step.character.id}
				character={step.character}
				interactive={false}
			/>{/if} chose
	{/snippet}
</SeatChooser>

<ReminderMoveConfirm bind:this={moveConfirm} {grimoire} />

<style>
	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.icon {
		display: grid;
		place-items: center;
		width: calc(3.5 * var(--u));
		height: calc(3.5 * var(--u));
		--icon-size: calc(2.25 * var(--u));
		color: var(--heading);
	}
	.number {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.card-text {
		font-weight: 600;
	}
	.head-text {
		flex: 1;
		min-width: 0;
	}
	.who {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.ability {
		margin: var(--space-1) 0 0;
		font-family: var(--font-ability);
		line-height: 1.4;
	}
	.text {
		font-family: var(--font-ability);
		line-height: 1.4;
	}
	h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: 1rem;
	}
	/* Room under each token for its words' band, and beside it for words wider than it. */
	.reminders {
		display: grid;
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.reminders li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 0 0 var(--space-2) var(--space-2);
	}
	.where {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
