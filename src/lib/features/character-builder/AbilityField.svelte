<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { SORT_ORDER_PHRASES, type Character } from '#lib/core/data/index.ts';
	import {
		CHOICE_PHRASES,
		RESULT_PHRASES,
		readAbility,
		readAction,
		setupPartText,
		withChoice,
		withOpening,
		withResult,
		withSetup,
		type SetupPart
	} from '#lib/core/rules/index.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import SetupPartDialog from './SetupPartDialog.svelte';

	/**
	 * The ability, from TPI's standard parts (Trevor, 2026-10-18): the Sort Order phrase it
	 * opens with, who it chooses and what then happens (the clauses official abilities use
	 * most), the rest in the user's words, and the [setup] bracket built clause by clause.
	 * The text field always holds the whole ability and can be typed freely; the part controls
	 * read it and rewrite only their own part.
	 */
	interface Props {
		ability: string;
		/** The character's name, for "+0 to +2 [name]s". */
		name: string;
		/** Characters a setup change can link to ("+the King"). */
		characters: readonly Character[];
		onchange: (ability: string) => void;
	}

	let { ability, name, characters, onchange }: Props = $props();

	/** The Select's value for an ability that opens with none of the phrases. */
	const NONE = 'none';

	let addOpen = $state(false);

	const findByName = (text: string) => {
		const c = characters.find((x) => x.name.toLowerCase() === text.trim().toLowerCase());
		return c && { id: c.id, name: c.name };
	};
	const parts = $derived(readAbility(ability, name, findByName));
	const action = $derived(readAction(parts.rest, !!parts.opening));

	const phraseOptions = (phrases: readonly string[]) => [
		{ value: NONE, label: t('character-builder.openingNone') },
		...phrases.map((phrase) => ({ value: phrase, label: phrase }))
	];
	const openingOptions = phraseOptions(SORT_ORDER_PHRASES);
	const choiceOptions = phraseOptions(CHOICE_PHRASES);
	const resultOptions = phraseOptions(RESULT_PHRASES);
	const picked = (value: string) => (value === NONE ? '' : value);

	function setSetup(setup: SetupPart[]) {
		onchange(withSetup(ability, setup, name));
	}
</script>

<div class="ability-field">
	<Select
		label={t('character-builder.opening')}
		value={parts.opening || NONE}
		options={openingOptions}
		onChange={(opening: string) => onchange(withOpening(ability, picked(opening), name))}
	/>
	<div class="action">
		<Select
			label={t('character-builder.choice')}
			value={action.choice || NONE}
			options={choiceOptions}
			onChange={(choice: string) => onchange(withChoice(ability, picked(choice), name))}
		/>
		<Select
			label={t('character-builder.result')}
			value={action.result || NONE}
			options={resultOptions}
			onChange={(result: string) => onchange(withResult(ability, picked(result), name))}
		/>
	</div>
	<TextField
		label={t('character-builder.ability')}
		multiline
		value={ability}
		testid="character-ability"
		oninput={onchange}
	/>
	<section class="setup" aria-label={t('character-builder.setupChanges')}>
		<div class="setup-head">
			<h3>{t('character-builder.setupChanges')}</h3>
			<Button onclick={() => (addOpen = true)}>{t('character-builder.addSetupChange')}</Button>
		</div>
		<ul data-testid="setup-parts">
			{#each parts.setup as part, i (i)}
				{@const text = setupPartText(part, name)}
				<li>
					<span>{text}</span>
					<DeleteButton
						label={t('character-builder.removeSetupChange', { text })}
						onclick={() => setSetup(parts.setup.filter((_, j) => j !== i))}
					/>
				</li>
			{:else}
				<li class="muted">{t('common.none')}</li>
			{/each}
		</ul>
	</section>
</div>

<SetupPartDialog
	bind:open={addOpen}
	self={name}
	{characters}
	onAdd={(part) => setSetup([...parts.setup, part])}
/>

<style>
	.ability-field {
		display: grid;
		gap: var(--space-3);
	}
	.action {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, calc(14 * var(--u))), 1fr));
		gap: var(--space-3);
	}
	.setup-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
	}
	h3 {
		margin: 0;
		font-size: 1rem;
	}
	ul {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: var(--tap-target);
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>
