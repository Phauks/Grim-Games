<script lang="ts">
	import type { SpecialRule } from '#lib/core/modes/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { shownAbout } from './own-wording.svelte.ts';
	import { RULE_SWITCHES, switchOn, type SwitchChoices } from './rule-switches.ts';

	/**
	 * The special rules restated before a game starts (Trevor, 2026-10-22: "a screen that
	 * restates the special rules ... so storyteller perfectly understands", with "a back button
	 * to go back to script selection and toggling of the rules"). Each rule with its description
	 * and its own switches, which can still be changed here as on New game (Trevor, 2026-10-23:
	 * "allow for toggling options in the special rules in this game screen"). Back returns to
	 * New game as it was; Start game starts.
	 */
	interface Props {
		open: boolean;
		rules: readonly SpecialRule[];
		choices: SwitchChoices;
		onSwitch: (choices: SwitchChoices) => void;
		onStart: () => void;
	}

	let { open = $bindable(), rules, choices, onSwitch, onStart }: Props = $props();
</script>

<Dialog bind:open title={t('modes.recap.title')} size="full">
	<ul role="list" class="recap" data-testid="rules-recap">
		{#each rules as rule (rule.id)}
			<li>
				<h3>{rule.name}</h3>
				<p>{shownAbout(rule) ?? rule.parts.text?.join(' ') ?? t('common.none')}</p>
				{#each RULE_SWITCHES[rule.id] ?? [] as sw (sw.id)}
					<Toggle
						label={t(sw.label(rule.id))}
						checked={switchOn(choices, rule.id, sw)}
						onChange={(on) => onSwitch({ ...choices, [`${rule.id}:${sw.id}`]: on })}
					/>
				{/each}
			</li>
		{/each}
	</ul>
	{#snippet actions()}
		<ModalActions
			confirmLabel={t('modes.start')}
			confirmIcon="grimoire"
			onConfirm={() => {
				open = false;
				onStart();
			}}
		>
			{#snippet start()}
				<!-- Trevor's own exception to "no Back buttons" (2026-10-22). -->
				<Button variant="quiet" icon="back" onclick={() => (open = false)}>
					{t('modes.recap.back')}
				</Button>
			{/snippet}
		</ModalActions>
	{/snippet}
</Dialog>

<style>
	.recap {
		display: grid;
		gap: var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		gap: var(--space-1);
	}
	h3,
	p {
		margin: 0;
	}
</style>
