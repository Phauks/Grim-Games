<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { reportWithDiagnostics } from '#lib/features/errors/report-with-diagnostics.ts';

	/**
	 * Report an issue beside a script's own actions (Trevor, 2026-10-23: "add report button to
	 * those screens"), for screens whose script sits over the footer's link. The form opens as a
	 * script or data report titled with the script's name; the script goes with it
	 * (offerScriptToReports), and this device's diagnostics, as from the menu's.
	 */
	interface Props {
		/** The script's name, to start the title with; none leaves the title empty. */
		name?: string;
		disabled?: boolean;
	}

	let { name, disabled = false }: Props = $props();
</script>

<IconButton
	icon="report"
	label={t('shell.reportIssue')}
	{disabled}
	onclick={() =>
		void reportWithDiagnostics({ kind: 'data', title: name ? `${name}: ` : undefined })}
/>
