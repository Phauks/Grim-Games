<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import { ruleReminders, type ReminderId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterDialog from '#lib/features/characters/CharacterDialog.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { placingAlignment } from './board.ts';
	import CharacterPicker from './CharacterPicker.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { tokenLabel } from './reminders.ts';
	import RulesAtSetting from './RulesAtSetting.svelte';

	/**
	 * Fabled and Loric are rules of the game, not seats (Trevor, 2026-10-17): the dialogs the
	 * board's rule tokens open. Adding one, one's entry with its reminders, all of them at once
	 * from the corner stack, and removing one. The tokens themselves stay on the board, where
	 * their reminders are dragged.
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
	/** Every Fabled and Loric at once, from the corner stack. */
	let rulesGroupOpen = $state(false);
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

	/** Every Fabled and Loric at once. */
	export function showAll(): void {
		rulesGroupOpen = true;
	}

	/** A character's details, as its token opens them. */
	export function details(character: Character): void {
		ruleDetails = character;
		ruleDetailsOpen = true;
	}
</script>

<!-- A Fabled or Loric's reminders in its dialog; a tap opens one. -->
{#snippet heldList(id: CharacterId)}
	<!-- Nothing when it holds none; placed ones under a Reminders header (Trevor, 2026-10-18). -->
	{#if ruleReminders(game, id).length > 0}<h3 class="held-head">Reminders</h3>{/if}
	<div class="held-list" role="group" aria-label="Reminders">
		{#each ruleReminders(game, id) as reminder (reminder.reminderId)}
			<button
				type="button"
				class="held-chip"
				aria-label={reminder.label}
				disabled={watching}
				onclick={() => onReminder(reminder.reminderId)}
			>
				<ReminderToken
					label={tokenLabel(reminder)}
					character={characters.get(reminder.characterId)}
					alignment={placingAlignment(game, reminder, characters)}
				/>
			</button>
		{/each}
	</div>
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
	<RulesAtSetting />
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

<Dialog bind:open={rulesGroupOpen} title="Fabled and Loric">
	<ul class="rules-group">
		{#each game.ruleCharacters as id (id)}
			{@const character = characters.get(id)}
			{#if character}
				<li class="rule-detail">
					{@render ruleToken(character)}
					<div>
						<CharacterBadge characterId={id} {character} />
						<p>{character.ability}</p>
						{@render heldList(id)}
					</div>
					<DeleteButton
						label={removeRuleLabel(character.name)}
						disabled={watching}
						onclick={() => {
							ruleShown = id;
							ruleRemoveOpen = true;
						}}
					/>
				</li>
			{/if}
		{:else}
			<li class="none">None</li>
		{/each}
	</ul>
	<RulesAtSetting />
</Dialog>

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
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		margin-top: var(--space-2);
	}
	.held-chip {
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
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
	.rules-group {
		display: grid;
		gap: var(--space-3);
		margin: 0 0 var(--space-3);
		padding: 0;
		list-style: none;
	}
</style>
