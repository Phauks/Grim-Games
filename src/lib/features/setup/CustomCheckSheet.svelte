<script lang="ts">
	import NoneState from '#lib/ui/primitives/NoneState.svelte';
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import type { CheckSource, CustomCheck, NightCheck } from '#lib/core/rules/setup/custom-check.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import type { CharacterFormTab } from '#lib/features/character-builder/draft.ts';
	import StepPiece from '#lib/features/grimoire/night/StepPiece.svelte';
	import { stepName } from '#lib/features/grimoire/night/night-steps.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import SectionStack from '#lib/ui/layout/SectionStack.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';

	/**
	 * What the app assumes about one of the script's own characters (M85, Trevor 2026-11-14:
	 * option A), one row per part with where it came from: the script, its rules, or a guess
	 * from its ability, marked by an icon. Each row's pencil opens the Character builder on the
	 * tab that changes it; Checked marks it as looked at.
	 */
	interface Props {
		open?: boolean;
		character: Character | undefined;
		check: CustomCheck | undefined;
		checked: boolean;
		/** Opens the Character builder on `tab`. */
		onEdit: (tab: CharacterFormTab) => void;
		onChecked: () => void;
	}

	let { open = $bindable(false), character, check, checked, onEdit, onChecked }: Props = $props();

	const SOURCE = {
		script: 'setup.ownCheck.fromScript',
		rules: 'setup.ownCheck.fromRules',
		guessed: 'setup.ownCheck.guessed',
		unknown: 'setup.ownCheck.unknown'
	} as const satisfies Record<CheckSource, string>;
	const doubtful = (source: CheckSource) => source === 'guessed' || source === 'unknown';
</script>

{#snippet source(from: CheckSource)}
	<span class="source" data-source={from}
		><Icon name={doubtful(from) ? 'warning' : 'check'} />{t(SOURCE[from])}</span
	>
{/snippet}

{#snippet row(
	label: string,
	tab: CharacterFormTab,
	value: Snippet<[CustomCheck]>,
	testid: string,
	c: CustomCheck
)}
	<div class="row" data-testid="own-check-{testid}">
		<span class="label">{label}</span>
		<span class="value">{@render value(c)}</span>
		<IconButton
			icon="edit"
			label={t('setup.ownCheck.change', { part: label })}
			onclick={() => onEdit(tab)}
		/>
	</div>
{/snippet}

{#snippet night(n: NightCheck)}
	{#if !n.wakes}<NoneState inline />{:else}
		<span class="after">{t('setup.ownCheck.after')}</span>
		{#if n.after?.kind === 'character'}<StepPiece
				template="badge"
				step={n.after}
				interactive={false}
			/>{:else if n.after}{stepName(n.after)}{/if}
		{@render source(n.source)}
	{/if}
{/snippet}

{#snippet firstNight(c: CustomCheck)}{@render night(c.first)}{/snippet}
{#snippet otherNights(c: CustomCheck)}{@render night(c.other)}{/snippet}
{#snippet tokens(c: CustomCheck)}
	{#each c.reminders as label, i (i)}<ReminderToken {label} {character} />{:else}<NoneState
			inline
		/>{/each}
{/snippet}
{#snippet placedOn(c: CustomCheck)}
	{#if c.placedOn}
		{c.placedOn === 'rules' ? t('setup.ownCheck.asRules') : t('setup.ownCheck.anySeat')}
		{@render source(c.placedOn)}
	{:else}<NoneState inline />{/if}
{/snippet}
{#snippet beforeGame(c: CustomCheck)}
	{#if c.beforeGame}
		{c.beforeGame === 'rules' ? t('setup.ownCheck.asRules') : t('common.none')}
		{@render source(c.beforeGame)}
	{:else}<NoneState inline />{/if}
{/snippet}
{#snippet day(c: CustomCheck)}
	{#each c.day as reminder, i (i)}<span class="line"
			>{reminder.text}{@render source(reminder.source)}</span
		>{:else}<NoneState inline />{/each}
{/snippet}
{#snippet setup(c: CustomCheck)}
	{#if c.setup}{c.setup.summary}{@render source(c.setup.source)}{:else}<NoneState inline />{/if}
{/snippet}
{#snippet rules(c: CustomCheck)}<CountBadge
		count={c.rules}
		testid="own-check-rule-count"
	/>{/snippet}

<BottomSheet bind:open title={t('setup.check.check')} wide>
	{#snippet heading()}{t('setup.check.check')}
		{#if character}<CharacterPiece
				template="badge"
				characterId={character.id}
				{character}
				interactive={false}
			/>{/if}{/snippet}
	{#if character && check}
		<div class="sheet" data-testid="own-check">
			<CharacterPiece template="row" {character} ability interactive={false} />
			<SectionStack edge>
				{@render row(t('setup.ownCheck.firstNight'), 'night', firstNight, 'first-night', check)}
				{@render row(t('setup.ownCheck.otherNights'), 'night', otherNights, 'other-nights', check)}
				{@render row(t('setup.ownCheck.reminders'), 'character', tokens, 'reminders', check)}
				{@render row(t('setup.ownCheck.placedOn'), 'rules', placedOn, 'placed-on', check)}
				{@render row(t('setup.ownCheck.beforeGame'), 'rules', beforeGame, 'before-game', check)}
				{@render row(t('setup.ownCheck.day'), 'rules', day, 'day', check)}
				{@render row(t('setup.ownCheck.setup'), 'rules', setup, 'setup', check)}
				{@render row(t('setup.ownCheck.rules'), 'rules', rules, 'rules', check)}
			</SectionStack>
			<ModalActions
				onCancel={() => (open = false)}
				onConfirm={() => {
					onChecked();
					open = false;
				}}
				disabled={checked}
				confirmLabel={t('setup.ownCheck.checked')}
				confirmIcon="check"
			/>
		</div>
	{/if}
</BottomSheet>

<style>
	.sheet {
		display: grid;
		gap: var(--space-2);
	}
	.row {
		display: grid;
		grid-template-columns: 7em minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		padding-block: var(--space-1);
	}
	.label {
		font-weight: 600;
	}
	.value {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		min-width: 0;
	}
	.line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		width: 100%;
	}
	.source,
	.after {
		display: inline-flex;
		align-items: center;
		gap: 0.25em;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
</style>
