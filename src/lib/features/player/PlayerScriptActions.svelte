<script lang="ts">
	import ReportButton from '#lib/features/reports/ReportButton.svelte';
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import { scriptLogo } from '#lib/core/data/script-logo.ts';
	import ShareControl from '#lib/features/scripts/ShareControl.svelte';
	import { shareTargetFor, type Shareable } from '#lib/features/scripts/share-codes.ts';
	import LightSheetSwitch from './LightSheetSwitch.svelte';
	import PrintScriptButton from './PrintScriptButton.svelte';

	/**
	 * The light background switch, Print, Share and Report an issue for the players' script: /play's
	 * title line, and the Script the
	 * Storyteller opens from the board, which matches it exactly (Trevor, 2026-10-19).
	 */
	interface Props {
		script: LoadedScript | undefined;
		version?: string;
		/** What Share links to; without it Share is shown disabled. */
		share: Shareable | undefined;
		/** The live room this device is in, whose link and join code Share hands on. */
		room?: string;
	}

	let { script, version, share, room }: Props = $props();
	const target = $derived.by(() => {
		if (!share) return undefined;
		const from = share;
		return () => shareTargetFor(from, location.origin);
	});
</script>

<!-- One switch for the Script and Night tabs, beside Print and Share (Trevor, 2026-10-23). -->
<LightSheetSwitch />
<PrintScriptButton {script} {version} />
<ShareControl
	what="script"
	title={script?.name ?? 'Script'}
	author={script?.meta.author}
	{version}
	logo={script ? scriptLogo(script) : undefined}
	{target}
	{room}
/>
<ReportButton name={script?.name} disabled={!script} />
