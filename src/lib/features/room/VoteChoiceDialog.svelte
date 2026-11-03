<script lang="ts">
	import {
		choiceId,
		choiceLabel,
		isEmptyChoice,
		type VoteChoice
	} from '#lib/core/sync/vote-choice.ts';
	import ScriptPicker from '#lib/features/modes/ScriptPicker.svelte';
	import type {
		ScriptChoice,
		ScriptChoiceOption
	} from '#lib/features/modes/script-choices.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';

	/**
	 * One choice on the room vote's ballot (Trevor, 2026-11-03, plan M33, mockup B): a script,
	 * a game mode and special rules, each optional, and the name the ballot will show. "+ New
	 * choice" opens it empty; a row's pencil opens it on that choice.
	 */
	interface Props {
		open: boolean;
		/** Its place on the ballot, from 1, for the title. */
		number: number;
		/** The choice being changed; a new one when absent. */
		choice?: VoteChoice;
		/** The scripts New game offers, by its own ids, for the script's name. */
		scripts: ScriptChoiceOption[];
		/** New game's game modes, Standard first. */
		modes: { value: string; label: string }[];
		/** New game's special rules. */
		rules: { value: string; label: string }[];
		/** The other choices' ids: the same choice can't be on the ballot twice. */
		taken: string[];
		onSave: (choice: VoteChoice) => void;
	}

	let {
		open = $bindable(),
		number,
		choice,
		scripts,
		modes,
		rules,
		taken,
		onSave
	}: Props = $props();

	let withScript = $state(true);
	let script = $state<ScriptChoice>('tb');
	let mode = $state('');
	let ruleIds = $state<string[]>([]);

	/** None first: a choice with no game mode keeps New game's own. */
	const modeOptions = $derived([{ value: '', label: t('common.none') }, ...modes]);

	// Each opening starts from the choice it edits, or from Trouble Brewing alone.
	$effect(() => {
		if (!open) return;
		withScript = choice ? !!choice.script : true;
		script = (choice?.script as ScriptChoice | undefined) ?? 'tb';
		mode = choice?.mode ?? '';
		ruleIds = choice ? [...choice.rules] : [];
	});

	const draft = $derived<VoteChoice>({
		...(withScript ? { script } : {}),
		...(mode ? { mode } : {}),
		rules: rules.map((r) => r.value).filter((id) => ruleIds.includes(id))
	});
	const label = $derived(
		choiceLabel({
			script:
				draft.script && (scripts.find((s) => s.value === draft.script)?.label ?? draft.script),
			mode: draft.mode && modes.find((m) => m.value === draft.mode)?.label,
			rules: draft.rules.map((id) => rules.find((r) => r.value === id)?.label ?? id)
		})
	);
	const savable = $derived(!isEmptyChoice(draft) && !taken.includes(choiceId(draft)));

	function setRule(id: string, on: boolean) {
		ruleIds = on ? [...ruleIds, id] : ruleIds.filter((r) => r !== id);
	}

	function save() {
		if (!savable) return;
		onSave(draft);
		open = false;
	}
</script>

<Dialog bind:open title={t('room.scriptVote.choice', { number })}>
	<form
		class="choice"
		data-testid="vote-choice-dialog"
		onsubmit={(e) => {
			e.preventDefault();
			save();
		}}
	>
		<!-- The name first, so it shows above a long list of rules. -->
		<p class="label" data-testid="vote-choice-label">
			<span class="muted">{t('room.scriptVote.onBallot')}</span>
			<span class:muted={!label}>{label || t('common.none')}</span>
		</p>
		<Toggle
			label={t('room.scriptVote.withScript')}
			checked={withScript}
			onChange={(on) => (withScript = on)}
		/>
		<!-- Kept in place while off, so nothing moves (Trevor: no reflow). -->
		<div class="script" class:off={!withScript} inert={!withScript}>
			<ScriptPicker
				label={t('room.scriptVote.subject.script')}
				hideLabel
				value={script}
				onChange={(v) => (script = v)}
			/>
		</div>
		<Select
			label={t('room.scriptVote.subject.mode')}
			options={modeOptions}
			value={mode}
			onChange={(v) => (mode = v)}
		/>
		<fieldset class="rules">
			<legend>{t('room.scriptVote.subject.rules')}</legend>
			{#each rules as rule (rule.value)}
				<Toggle
					label={rule.label}
					checked={ruleIds.includes(rule.value)}
					onChange={(on) => setRule(rule.value, on)}
				/>
			{/each}
		</fieldset>
		<ModalActions submit disabled={!savable} onCancel={() => (open = false)} />
	</form>
</Dialog>

<style>
	.choice {
		display: grid;
		gap: var(--space-3);
	}
	.off {
		opacity: 0.5;
	}
	.rules {
		display: grid;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.rules legend {
		padding: 0;
		margin-bottom: var(--space-1);
	}
	.rules > :global(* + *) {
		border-top: 1px solid var(--border);
	}
	.label {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>
