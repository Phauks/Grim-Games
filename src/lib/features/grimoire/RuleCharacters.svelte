<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { rulesOf } from '#lib/core/data/rules/index.ts';
	import { ruleReminders, type ReminderId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
	import CharacterDialog from '#lib/features/characters/CharacterDialog.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import BoardReminder from './BoardReminder.svelte';
	import ReminderTokenRow from './ReminderTokenRow.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { placingAlignment } from './board.ts';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { placedLook } from './reminders.ts';
	import { kindOf, type RuleKind } from './rule-stacks.ts';

	/**
	 * Fabled and Loric are rules of the game, not seats (Trevor, 2026-10-17): the dialogs the
	 * board's rule tokens open. Adding one, one's entry with its reminders, all of them at once
	 * from the corner stack, and removing one. The tokens themselves stay on the board, where
	 * their reminders are dragged. An ability the Storyteller holds (the Plague Doctor's
	 * Minion) opens here too, to change or remove it.
	 */
	interface Props {
		grimoire: Grimoire;
		/** A spectator reads, never changes. */
		watching?: boolean;
		/** Opens one of a rule character's reminders. */
		onReminder: (reminderId: ReminderId) => void;
	}

	let { grimoire, watching = false, onReminder }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);

	let ruleOpen = $state(false);
	let ruleShown = $state<CharacterId | undefined>();
	let ruleShownOpen = $state(false);
	/** One corner stack's Fabled or Loric at once. */
	let rulesGroupOpen = $state(false);
	let rulesGroupKind = $state<RuleKind>('fabled');
	const rulesGroup = $derived(
		game.ruleCharacters.filter((id) => kindOf(id, characters) === rulesGroupKind)
	);
	const removeRuleLabel = (name: string) => `Remove ${name} from the game`;
	let ruleRemoveOpen = $state(false);
	const ruleShownCharacter = $derived(ruleShown ? characters.get(ruleShown) : undefined);
	// Tapping a Fabled or Loric token opens its entry, as a seat's token does (Trevor, 2026-10-18).
	let ruleDetails = $state<Character | undefined>();
	let ruleDetailsOpen = $state(false);

	/** Picks a Fabled or Loric to add. */
	export function add(): void {
		ruleOpen = true;
	}

	/** One Fabled or Loric's entry, with its reminders. */
	export function show(id: CharacterId): void {
		ruleShown = id;
		ruleShownOpen = true;
	}

	/** One stack's Fabled or Loric at once. */
	export function showAll(kind: RuleKind = 'fabled'): void {
		rulesGroupKind = kind;
		rulesGroupOpen = true;
	}

	// An ability the Storyteller holds, by the character that gave it.
	let abilityVia = $state<CharacterId | undefined>();
	let abilityOpen = $state(false);
	let abilityPickOpen = $state(false);
	let abilityRemoveOpen = $state(false);
	const abilityHeld = $derived(
		game.storytellerAbilities?.find((a) => a.via === abilityVia)?.characterId
	);
	const abilityCharacter = $derived(abilityHeld ? characters.get(abilityHeld) : undefined);
	const abilityTypes = $derived(
		(abilityVia && rulesOf(abilityVia, characters)?.givesAbility?.types) || []
	);

	/** An ability the Storyteller holds, given by `via`. */
	export function showAbility(via: CharacterId): void {
		abilityVia = via;
		abilityOpen = true;
	}

	function setAbility(characterId: CharacterId | undefined) {
		abilityPickOpen = false;
		if (characterId === undefined) abilityOpen = false;
		if (abilityVia) grimoire.run({ type: 'SetStorytellerAbility', via: abilityVia, characterId });
	}

	/** A character's details, as its token opens them. */
	export function details(character: Character): void {
		ruleDetails = character;
		ruleDetailsOpen = true;
	}
</script>

<!-- A Fabled or Loric's reminders in its dialog; a tap opens one. -->
{#snippet heldList(id: CharacterId)}
	<!-- Nothing, not even an empty row's room, when it holds none (Trevor, 2026-10-31: "hella
	     blank space"); placed ones under a Reminders header (Trevor, 2026-10-18). -->
	{#if ruleReminders(game, id).length > 0}
		<h3 class="held-head">Reminders</h3>
		<!-- The tokens themselves, as on the board (Trevor, 2026-10-30). -->
		<div class="held-list" role="group" aria-label="Reminders">
			<ReminderTokenRow inline>
				{#each ruleReminders(game, id) as reminder (reminder.reminderId)}
					<BoardReminder
						{...placedLook(reminder, characters)}
						alignment={placingAlignment(game, reminder, characters)}
						ariaLabel={reminder.label}
						disabled={watching}
						onTap={() => onReminder(reminder.reminderId)}
					/>
				{/each}
			</ReminderTokenRow>
		</div>
	{/if}
{/snippet}

{#snippet ruleToken(character: Character)}
	<button
		type="button"
		class="rule-token"
		aria-label={`About the ${character.name}`}
		onclick={() => details(character)}
	>
		<CharacterToken {character} size={64} />
	</button>
{/snippet}

<CharacterPicker
	bind:open={ruleOpen}
	title="Add Fabled or Loric"
	{characters}
	script={game.script}
	types={['fabled', 'loric']}
	alwaysAll
	onPick={(characterId) => {
		ruleOpen = false;
		grimoire.run({ type: 'AddRuleCharacter', characterId });
	}}
/>

<!-- eslint-disable-next-line grim/names-as-badges -- the rule character's own details, under its token -->
<Dialog bind:open={ruleShownOpen} title={ruleShownCharacter?.name ?? ''}>
	{#if ruleShownCharacter}
		<div class="rule-detail">
			{@render ruleToken(ruleShownCharacter)}
			<p>{ruleShownCharacter.ability}</p>
		</div>
		{@render heldList(ruleShownCharacter.id)}
	{/if}
	{#snippet headActions()}
		<!-- Beside the close X (Trevor, 2026-10-17); a red trash icon, named for screen readers. -->
		<DeleteButton
			label="Remove from the game"
			disabled={watching}
			onclick={() => (ruleRemoveOpen = true)}
		/>
	{/snippet}
</Dialog>

{#if ruleDetails}<CharacterDialog bind:open={ruleDetailsOpen} character={ruleDetails} />{/if}

<!-- One stack's, each as every list draws a character (CharacterRow). -->
<Dialog bind:open={rulesGroupOpen} title={rulesGroupKind === 'loric' ? 'Loric' : 'Fabled'}>
	<ul class="rules-group">
		{#each rulesGroup as id (id)}
			{@const character = characters.get(id)}
			{#if character}
				<li>
					<CharacterRow {character} info={details}>
						{#snippet end()}
							<DeleteButton
								label={removeRuleLabel(character.name)}
								disabled={watching}
								onclick={() => {
									ruleShown = id;
									ruleRemoveOpen = true;
								}}
							/>
						{/snippet}
						{@render heldList(id)}
					</CharacterRow>
				</li>
			{/if}
		{/each}
		{#if rulesGroup.length === 0}<li class="none">None</li>{/if}
	</ul>
</Dialog>

<Dialog bind:open={abilityOpen} title="Storyteller's ability">
	{#if abilityCharacter}
		<div class="rule-detail">
			{@render ruleToken(abilityCharacter)}
			<div>
				<CharacterBadge characterId={abilityCharacter.id} character={abilityCharacter} />
				<p>{abilityCharacter.ability}</p>
			</div>
		</div>
		<div class="actions">
			<Button variant="quiet" disabled={watching} onclick={() => (abilityPickOpen = true)}
				>Change</Button
			>
		</div>
	{/if}
	{#snippet headActions()}
		<DeleteButton
			label="Remove the Storyteller's ability"
			disabled={watching}
			onclick={() => (abilityRemoveOpen = true)}
		/>
	{/snippet}
</Dialog>

<CharacterPicker
	bind:open={abilityPickOpen}
	title="Storyteller's ability"
	{characters}
	script={game.script}
	types={abilityTypes}
	current={abilityHeld}
	onPick={setAbility}
/>

<ConfirmDialog
	bind:open={abilityRemoveOpen}
	title="Remove the Storyteller's ability?"
	danger
	onConfirm={() => setAbility(undefined)}
>
	{#if abilityHeld}
		<dl class="change">
			<dt>Now</dt>
			<dd>
				The Storyteller has <CharacterBadge
					characterId={abilityHeld}
					character={abilityCharacter}
				/>
			</dd>
			<dt>Becomes</dt>
			<dd>None</dd>
		</dl>
	{/if}
</ConfirmDialog>

<ConfirmDialog
	bind:open={ruleRemoveOpen}
	title="Remove from the game?"
	danger
	onConfirm={() => {
		ruleShownOpen = false;
		if (ruleShown) grimoire.run({ type: 'RemoveRuleCharacter', characterId: ruleShown });
	}}
>
	{#if ruleShown}
		<dl class="change">
			<dt>Now</dt>
			<dd>
				<CharacterBadge characterId={ruleShown} character={ruleShownCharacter} /> in play
			</dd>
			<dt>Becomes</dt>
			<dd>Not in play</dd>
		</dl>
	{/if}
</ConfirmDialog>

<style>
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0;
	}
	.change dt {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.change dd {
		margin: 0;
	}
	.held-head {
		margin: var(--space-2) 0 0;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--on-surface-muted);
	}
	.held-list {
		margin-top: var(--space-2);
	}
	.rule-detail {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}
	.rule-token {
		flex: none;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}
	.rule-detail p {
		margin: 0;
		font-family: var(--font-ability);
	}
	.rule-detail > div {
		flex: 1;
		min-width: 0;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--space-3);
	}
	/* Rows as tall as their contents, however tall the sheet (Trevor, 2026-10-30). */
	.rules-group {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
	}
</style>
