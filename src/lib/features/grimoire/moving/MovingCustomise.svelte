<script lang="ts">
	import {
		MOVING_BACKGROUNDS,
		formatParam,
		movingDefaults,
		movingPreset,
		presetOf,
		type MovingChoice,
		type MovingParamValue
	} from '#lib/core/backgrounds/moving.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import SettingColor from '#lib/ui/settings/SettingColor.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import type { BackgroundChoice } from '../backgrounds.ts';
	import MovingBackdrop from './MovingBackdrop.svelte';

	/**
	 * "Customise" under the background tiles (M43): always there, so nothing moves, and only
	 * usable while a moving background is chosen. It opens the scene's settings in a dialog
	 * with its own preview; nothing changes on the board until Confirm.
	 */
	interface Props {
		current: BackgroundChoice | undefined;
		onSave: (choice: BackgroundChoice) => void;
	}
	let { current, onSave }: Props = $props();

	const moving = $derived(current?.kind === 'moving' ? current : undefined);
	let open = $state(false);
	let draft = $state<MovingChoice>({ id: 'vortex', params: movingDefaults('vortex') });
	const background = $derived(MOVING_BACKGROUNDS[draft.id]);
	/** The preset the draft matches, or '' once a setting is the Storyteller's own. */
	const preset = $derived(presetOf(draft.id, draft.params) ?? '');

	function start() {
		if (!moving) return;
		draft = { id: moving.id, params: { ...moving.params } };
		open = true;
	}
	const set = (id: string, value: MovingParamValue) =>
		(draft.params = { ...draft.params, [id]: value });

	function confirm() {
		onSave({ kind: 'moving', id: draft.id, params: $state.snapshot(draft.params) });
		open = false;
	}
</script>

<Button variant="quiet" icon="edit" disabled={!moving} onclick={start}>
	{moving ? `Customise ${MOVING_BACKGROUNDS[moving.id].label}` : 'Customise a moving background'}
</Button>

<Dialog bind:open title={`Customise ${background.label}`} size="full">
	{#snippet aside()}
		<div class="preview" data-testid="moving-preview">
			<MovingBackdrop choice={draft} contained />
		</div>
	{/snippet}
	<div data-testid="moving-customise">
		<SettingSelect
			label="Preset"
			value={preset}
			options={[
				...Object.keys(background.presets).map((name) => ({ value: name, label: name })),
				...(preset ? [] : [{ value: '', label: 'Your own' }])
			]}
			onChange={(name) => {
				if (name) draft.params = movingPreset(draft.id, name);
			}}
		/>
		{#each background.params as param (param.id)}
			{@const value = draft.params[param.id]}
			{@const off = !!param.when && draft.params[param.when] !== true}
			{#if param.type === 'colour'}
				<!-- A colour picker has no disabled state of its own: held in place, faded. -->
				<div class="param" class:off inert={off}>
					<SettingColor
						label={param.label}
						value={String(value)}
						custom={value !== param.value}
						onChange={(v) => set(param.id, v)}
						onReset={() => set(param.id, param.value)}
					/>
				</div>
			{:else if param.type === 'range'}
				<SettingSlider
					label={param.label}
					value={Number(value)}
					min={param.min}
					max={param.max}
					step={param.step}
					defaultValue={param.value}
					format={(v) => formatParam(param, v)}
					disabled={off}
					onChange={(v) => set(param.id, v)}
				/>
			{:else}
				<SettingToggle
					label={param.label}
					checked={value === true}
					disabled={off}
					onChange={(v) => set(param.id, v)}
				/>
			{/if}
		{/each}
	</div>
	{#snippet actions()}
		<ModalActions onCancel={() => (open = false)} onConfirm={confirm} />
	{/snippet}
</Dialog>

<style>
	.preview {
		position: relative;
		width: 100%;
		aspect-ratio: 3 / 2;
		overflow: hidden;
		border-radius: var(--radius-md);
		isolation: isolate;
	}
	.param.off {
		opacity: 0.4;
	}
</style>
