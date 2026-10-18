<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	// Draft for Trevor's review (2026-10-15). Describes only what the app does today; update it
	// whenever a feature sends or stores something new (live rooms).
	import { resolve } from '$app/paths';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
</script>

<svelte:head>
	<title>Privacy policy · {APP_NAME}</title>
</svelte:head>

<!-- One column across the page width, not a narrow reading strip (Trevor, 2026-10-16). -->
<Page title="Privacy policy">
	{#snippet subtitle()}Last updated 18 October 2026{/snippet}
	<PageSection title="Summary">
		<p>
			{APP_NAME} has no analytics, no advertising and no tracking cookies. Your games and settings stay
			on your device. Our server stores a custom script only when you share it, a live room's public table
			only while it is open, a report only when you send one, and your account only if you sign in.
		</p>
	</PageSection>
	<PageSection title="What stays on your device">
		<ul>
			<li>
				Your games, ended games, player notes, scratch-pad drawings and grimoire backgrounds,
				including pictures you add (IndexedDB).
			</li>
			<li>Your 20 most recently loaded scripts (IndexedDB).</li>
			<li>
				Your settings and screen choices, such as theme, fonts, text size, language, column widths
				and how you last viewed the <a href={resolve('/reference')}>Reference</a> page; your Library tags
				and folders; a script you are building; the characters you make and one you are building; your
				custom info tokens; the player names you have used; and setup in progress (localStorage).
			</li>
			<li>
				A log of up to 20 recent problems the app ran into: the error, where in the app and on which
				page it happened, and when. It never contains your games. You can view or clear it from
				Diagnostics, Problems (localStorage).
			</li>
			<li>
				For each script you shared with a code, a random key kept for deleting it (localStorage).
			</li>
			<li>
				For a live room, its code, your device's key for it and the name you joined with
				(localStorage).
			</li>
			<li>Copies of wiki pages you have opened, and of script lists you have browsed.</li>
			<li>A copy of the app itself, so it works offline, plus images from homebrew scripts.</li>
		</ul>
		<p>
			None of this is sent to us, apart from a script you share, a live room's public table, a
			report you send, and your scripts if you sign in (below). Clearing this site's data in your
			browser deletes it all. Settings, Data lets you clear parts of it, and Reset settings resets
			your settings.
		</p>
	</PageSection>
	<PageSection title="Shared scripts">
		<p>
			When you tap Share or QR code for a custom script, the app uploads that script to our server
			and stores it under a random six-digit code, such as 482 913. Nothing is uploaded just by
			opening a page. Official editions and BotC Scripts scripts are never uploaded: their link only
			names the edition or the script's public number.
		</p>
		<ul>
			<li>No name, account or IP address is stored with the script.</li>
			<li>
				Anyone who has or guesses the code can open the script, so don't treat a shared script as
				private.
			</li>
			<li>It is deleted automatically 30 days after it was last opened.</li>
			<li>
				To stop people guessing codes, our server limits how many codes one IP address can look up
				or create each minute, using Cloudflare's rate limiter. We do not store the address.
			</li>
			<li>
				The code appears in our request logs as part of the address the app asks our server for; the
				script itself never does.
			</li>
			<li>
				If a code can't be made, for example while you are offline, the app shares a longer link
				that carries the whole script in the part of the address browsers never send to a server.
			</li>
		</ul>
	</PageSection>
	<PageSection title="Live rooms (Players' phones)">
		<p>
			When the Storyteller opens Players' phones, the app opens a room on our server under a
			six-digit code. The room holds what everyone at the table can already see: each seat's number
			and player name, who looks dead, today's nominations and executions, and the script. It never
			holds characters, reminders, notes or anything else in the grimoire.
		</p>
		<ul>
			<li>Phones ask to join with a name, and the Storyteller approves each one.</li>
			<li>Each device proves who it is with a random key, which the room keeps only as a hash.</li>
			<li>A room is deleted when the Storyteller closes it, or 24 hours after it was last used.</li>
			<li>The room code appears in our request logs; the room's contents don't.</li>
			<li>
				Our server limits how many rooms one IP address can open or join each minute, using
				Cloudflare's rate limiter. We do not store the address.
			</li>
		</ul>
	</PageSection>
	<PageSection title="Accounts (optional)">
		<p>
			Signing in is optional, and the app works fully without it. It isn't available on this site
			yet. When it is, and you sign in, we store, in Cloudflare Durable Object storage:
		</p>
		<ul>
			<li>Your email address.</li>
			<li>
				Your sign-in sessions: a random token, stored only as a hash, with a short device
				description such as "Chrome on Android" and when the session was created and last used. A
				session ends when you sign out, or after 180 days unused.
			</li>
			<li>
				Your scripts: every script you add while signed in, and, the first time you sign in on a
				device, the scripts already in its Recent list. You can remove them on the Account page.
			</li>
		</ul>
		<p>
			Your browser keeps the session in a cookie that is sent only to our server and read only when
			you sign in or use your account; it is not used for tracking. Sign-in codes are kept as hashes
			and expire after 10 minutes, and one email address can be sent at most 5 codes an hour.
			Sign-in requests are limited per network address using Cloudflare's rate limiter; we do not
			store the address. Nothing is shared with anyone. The
			<a href={resolve('/account')}>Account</a> page lets you download everything, or delete your account
			and all its data immediately.
		</p>
		<p>
			When you sign in, we email a one-time sign-in code and link to the address you entered, sent
			from sign-in@grimbinder.com through Cloudflare Email Service. Nothing else is emailed.
		</p>
		<p>
			On the Preview (test) version no email is sent: the sign-in code is shown on screen, and the
			code, the sign-in link and your email address are written to our server log.
		</p>
	</PageSection>
	<PageSection title="Reports">
		<p>
			"Report an issue", "Report a problem" and the problem log open a report form in the app.
			Nothing is sent until you tap Send. A report holds:
		</p>
		<ul>
			<li>
				What you write: the kind of report, a title, a description and, if you add one, a way to
				contact you.
			</li>
			<li>
				The page you were on, the app version and your browser's description, listed under "Sent
				with it" before you send.
			</li>
			<li>
				A problem's details, or from the Diagnostics page its summary of this device and the app,
				only if you leave them in. It never holds player names, notes, scripts, games or room codes,
				and web addresses are shortened.
			</li>
		</ul>
		<p>
			Reports are stored on our server (Cloudflare Durable Object storage) for the app's maintainer
			to read. Your IP address is used to limit how many reports can be sent each minute and is not
			stored with the report. Older finished reports are deleted when storage fills.
		</p>
	</PageSection>
	<PageSection title="Hosting">
		<p>
			The app is served by Cloudflare. Like any website, each request your browser makes reaches
			Cloudflare's servers with your IP address, browser details and the page address. We keep
			Cloudflare's request logs, including the full address of each request to our server, to find
			and fix errors. Cloudflare deletes them after 7 days, and we do not use them to identify or
			follow anyone. See
			<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener"
				>Cloudflare's privacy policy</a
			>.
		</p>
	</PageSection>
	<PageSection title="Other sites the app contacts">
		<ul>
			<li>
				<strong>Blood on the Clocktower wiki.</strong> To show rules definitions and character pages,
				the app downloads the wiki's Glossary page and the page of each character you open from wiki.bloodontheclocktower.com,
				again after a week, and keeps copies on your device. The wiki sees which character pages you open,
				but nothing else about you or your games.
			</li>
			<li>
				<strong>BotC Scripts.</strong> When you search or browse botcscripts.com, or load a script from
				it, the app sends your search words and filters (such as characters, author or edition) or the
				script's public number to our server, which asks botcscripts.com and keeps the answer for a few
				minutes. These appear in our request logs, but never anything about your games. botcscripts.com
				sees our server, not you.
			</li>
			<li>
				<strong>Other script and character lists.</strong> For the Official custom scripts, the Carousel
				Script Collection, the BotC Homebrew Wiki and Bloodstar Clocktica, our server reads bloodontheclocktower.com,
				the collection's Google Doc and the files it links on Google Drive, botchomebrew.wiki and bloodstar.clocktica.com,
				and keeps the answers for up to a day. Bloodstar links you paste are read the same way. Those
				sites see our server, not you, and nothing about you is sent.
			</li>
			<li>
				<strong>A link you load a script from.</strong> "Load from a link" downloads the script straight
				from the site you name (without cookies), so that site sees your request like any page visit (BotC
				Scripts and Bloodstar links go through our server instead, as above). Pasted and uploaded scripts
				never leave your device unless you share them.
			</li>
			<li>
				<strong>Homebrew images.</strong> A homebrew script's character images load from the sites the
				script names, which see your request like any page visit.
			</li>
			<li>
				<strong>GitHub.</strong> If the app fails to start, its error screen links to GitHub's list of
				issue forms on github.com instead of the report form. Nothing is sent until you submit a form
				there, under your GitHub account.
			</li>
			<li>
				<strong>GitHub's public API.</strong> When an update is ready, the update card may ask api.github.com
				which changes it brings, sending only the two version numbers (commit ids). It sends no game data,
				settings or account details.
			</li>
		</ul>
	</PageSection>
	<PageSection title="Changes">
		<p>
			We will update this page before the app starts sending or storing anything new. Questions can
			be asked through Report an issue.
		</p>
	</PageSection>
</Page>

<style>
	p,
	ul {
		margin: 0;
	}
	li + li {
		margin-top: var(--space-2);
	}
</style>
