<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { formatDigitCode } from '#lib/core/codes/digit-code.ts';
	import { normaliseShareCode, SHARE_CODE_DIGITS } from './share-codes-api.ts';

	/**
	 * Typing a six-digit script code. Phones show their number pad (`inputmode="numeric"`);
	 * spaces and hyphens are ignored, and a pasted link's code works too.
	 */
	interface Props {
		/** The complete code, or '' until it is complete. */
		value?: string;
		disabled?: boolean;
		/** Called when Enter is pressed on a complete code. */
		onsubmit?: (code: string) => void;
	}

	let { value = $bindable(''), disabled = false, onsubmit }: Props = $props();

	let typed = $state('');

	function oninput() {
		// A pasted share link (…#c=482913) gives its code.
		const fromLink = /[#&]c=([^&]+)/.exec(typed)?.[1];
		const code = normaliseShareCode(fromLink ?? typed);
		if (fromLink && code) typed = formatDigitCode(code);
		value = code ?? '';
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && value) {
			event.preventDefault();
			onsubmit?.(value);
		}
	}
</script>

<label class="field">
	<span>{t('scripts.code.label', { digits: SHARE_CODE_DIGITS })}</span>
	<input
		type="text"
		inputmode="numeric"
		autocomplete="off"
		enterkeyhint="go"
		placeholder="000 000"
		bind:value={typed}
		{oninput}
		{onkeydown}
		{disabled}
	/>
</label>

<style>
	.field {
		display: grid;
		gap: var(--space-1);
		margin-top: var(--space-3);
	}
	input {
		width: 100%;
		box-sizing: border-box;
		min-height: calc(1.5 * var(--tap-target));
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: max(1.8rem, 16px); /* px-ok: iOS zooms into fields under 16px */
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.15em;
		text-align: center;
	}
	input::placeholder {
		color: var(--on-surface-muted);
	}
</style>
