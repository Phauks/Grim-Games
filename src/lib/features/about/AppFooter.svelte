<script lang="ts">
	import { page } from '$app/state';
	import { buildInfo as info } from '#lib/build-info.ts';
	import { bugReportUrl, describeBuild, REPOSITORY_URL, shortCommit } from './report-issue.ts';

	const reportUrl = $derived(bugReportUrl(info, page.url.pathname, navigator.userAgent));
</script>

<footer>
	<!-- External GitHub links, not app routes. -->
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a class="report" href={reportUrl} target="_blank" rel="noopener">Report an issue</a>
	<p class="build" title={describeBuild(info)} data-testid="build-info">
		v{info.version} ·
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href="{REPOSITORY_URL}/commit/{info.commit}" target="_blank" rel="noopener"
			>{shortCommit(info)}</a
		>
		· {info.branch} · {info.channel} · built {new Date(info.builtAt).toLocaleString()}
	</p>
</footer>

<style>
	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		padding: 0.5rem 1rem;
		font-size: 0.8rem;
		opacity: 0.8;
	}
	a {
		color: inherit;
		display: inline-flex;
		align-items: center;
	}
	.build {
		margin: 0;
	}
	.build a {
		min-height: auto;
	}
</style>
