<script lang="ts">
	import { page } from '$app/state';
	import { buildInfo as info } from '#lib/build-info.ts';
	import { bugReportUrl, describeBuild, REPOSITORY_URL, shortCommit } from './report-issue.ts';

	const reportUrl = $derived(bugReportUrl(info, page.url.pathname, navigator.userAgent));
</script>

<footer>
	<!--
		The Pandemonium Institute asks projects that use official assets to show a Community
		Created Content logo (release.botc.app/resources, "Community Created Content logos").
		static/brand/ccc-parchment.webp is resources/community/ccc-parchment.png from
		ThePandemoniumInstitute/botc-release @ f10cd02, resized to 360px wide.
	-->
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a
		class="ccc"
		href="https://bloodontheclocktower.com/pages/community-created-content-policy"
		target="_blank"
		rel="noopener"
	>
		<img
			src="/brand/ccc-parchment.webp"
			width="120"
			height="45"
			alt="Community Created Content: not an official Blood on the Clocktower product"
		/>
	</a>
	<!-- External GitHub links, not app routes. -->
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a class="report" href={reportUrl} target="_blank" rel="noopener">Report an issue</a>
	<!-- Version and commit only; tap (or hover) for branch, channel and build time. -->
	<details class="build" title={describeBuild(info)} data-testid="build-info">
		<summary>v{info.version} · {shortCommit(info)}</summary>
		<p>
			{info.branch} · {info.channel} · built {new Date(info.builtAt).toLocaleString()} ·
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href="{REPOSITORY_URL}/commit/{info.commit}" target="_blank" rel="noopener">commit</a>
		</p>
	</details>
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
	.build summary {
		cursor: pointer;
		list-style: none;
		min-height: var(--tap-target);
		display: flex;
		align-items: center;
	}
	.build summary::-webkit-details-marker {
		display: none;
	}
	.build p {
		margin: 0 0 0.5rem;
	}
	.ccc img {
		display: block;
		height: auto;
	}
	.build p a {
		min-height: auto;
		display: inline;
	}
</style>
