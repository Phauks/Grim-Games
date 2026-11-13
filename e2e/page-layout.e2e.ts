import { expect, test } from '@playwright/test';

// Trevor (2026-10-17): every page reached from the sidebar uses the same page structure
// (src/lib/ui/layout/Page.svelte). The preview route renders every slot.

// On a phone the actions take their own row under the title; on anything wider they sit at
// the end of the title's row. Decided by the page's width, never by the buttons' width.
test('the page title row puts its actions beside the title, or under it on a phone', async ({
	page
}, testInfo) => {
	await page.goto('/spikes/page');
	const main = page.getByRole('main');
	const title = main.getByRole('heading', { level: 1, name: 'Page layout preview' });
	await expect(title).toBeVisible();
	await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
	const titleBox = (await title.boundingBox())!;
	const actionBox = (await main.getByRole('button', { name: 'Action' }).boundingBox())!;
	if (testInfo.project.name === 'phone') {
		expect(actionBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);
	} else {
		// Same row: the action's vertical middle sits within the title's line.
		const actionMiddle = actionBox.y + actionBox.height / 2;
		expect(actionMiddle).toBeGreaterThan(titleBox.y - actionBox.height / 2);
		expect(actionMiddle).toBeLessThan(titleBox.y + titleBox.height + actionBox.height / 2);
		expect(actionBox.x).toBeGreaterThan(titleBox.x);
	}
});

// Trevor (2026-10-18, "See weird header"): a wide text button squeezed the Towns page title
// until its words broke mid-word. No word of a title may ever break across lines.
for (const width of [undefined, 320]) {
	test(`a long title beside a text button never breaks a word${width ? ` (${width} wide)` : ''}`, async ({
		page
	}) => {
		if (width) await page.setViewportSize({ width, height: 800 });
		await page.goto('/spikes/page?long');
		const title = page.getByRole('heading', { level: 1 });
		await expect(title).toHaveText('Two games at once with a longer page title');
		const brokenWords = await title.evaluate((h1) => {
			const text = h1.firstChild as Text;
			const broken: string[] = [];
			for (const match of text.data.matchAll(/\S+/g)) {
				const range = document.createRange();
				range.setStart(text, match.index);
				range.setEnd(text, match.index + match[0].length);
				const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
				if (lines.size > 1) broken.push(match[0]);
			}
			return broken;
		});
		expect(brokenWords).toEqual([]);
		const button = page.getByRole('button', { name: 'Inspect the second town' });
		await expect(button).toBeInViewport({ ratio: 1 });
	});
}

test('subtitle, toolbar and sections follow the title in order', async ({ page }) => {
	await page.goto('/spikes/page');
	const main = page.getByRole('main');
	const top = async (box: Promise<{ y: number } | null>) => (await box)!.y;
	const title = await top(main.getByRole('heading', { level: 1 }).boundingBox());
	const subtitle = await top(main.getByText('Subtitle line').boundingBox());
	const search = await top(main.getByRole('searchbox', { name: 'Search' }).boundingBox());
	const first = await top(main.getByRole('heading', { name: 'First section' }).boundingBox());
	expect(subtitle).toBeGreaterThan(title);
	expect(search).toBeGreaterThan(subtitle);
	expect(first).toBeGreaterThan(search);
	await expect(main.getByRole('region', { name: 'First section' })).toBeVisible();
});

test('a collapsible section closes from its header and remembers it', async ({ page }) => {
	await page.goto('/spikes/page');
	const toggle = page.getByRole('button', { name: 'Second section' });
	await expect(page.getByText('Collapsible content')).toBeVisible();
	await toggle.tap();
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByText('Collapsible content')).toBeHidden();
	await page.reload();
	await expect(page.getByText('Collapsible content')).toBeHidden();
});

test('the side column sits above the content on phones and tablets', async ({ page }) => {
	await page.goto('/spikes/page');
	const side = await page.getByText('Side column').boundingBox();
	const first = await page.getByRole('heading', { name: 'First section' }).boundingBox();
	expect(side!.y).toBeLessThan(first!.y);
});

test('on a computer window the side column sits beside the content', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/spikes/page');
	const side = await page.getByText('Side column').boundingBox();
	const first = await page.getByRole('heading', { name: 'First section' }).boundingBox();
	expect(side!.x + side!.width).toBeLessThanOrEqual(first!.x);
});

// Trevor (2026-10-18): Account looked one way on first load and another after the sidebar was
// opened and closed. Sections keep their arrangement whether the sidebar is open or closed,
// and come back exactly as they first loaded.
for (const width of [undefined, 1280, 1600]) {
	test(`opening and closing the menu keeps the page's arrangement${width ? ` (${width} wide)` : ''}`, async ({
		page
	}) => {
		if (width) await page.setViewportSize({ width, height: 900 });
		await page.goto('/spikes/page?columns');
		await expect(page.getByRole('heading', { name: 'Third section' })).toBeVisible();
		const names = ['First section', 'Second section', 'Third section'];
		const boxes = async () =>
			Promise.all(
				names.map(async (name) => (await page.getByRole('heading', { name }).boundingBox())!)
			);
		/** Which sections sit in a column to the right of the first: the arrangement. */
		const columnsOf = (all: { x: number }[]) => all.map((box) => box.x > all[0].x + 1);
		const first = await boxes();
		const menu = page.getByRole('button', { name: 'Menu', exact: true }).first();
		const drawer = page.getByRole('dialog');
		await menu.click();
		if (!width) {
			// Phones and tablets: the menu is a drawer over the page.
			await expect(drawer).toBeVisible();
			await page.keyboard.press('Escape');
			await expect(drawer).toBeHidden();
		} else {
			await expect(menu).toHaveAttribute('aria-expanded', 'false');
			expect(columnsOf(await boxes())).toEqual(columnsOf(first));
			await menu.click();
		}
		await expect(menu).toHaveAttribute('aria-expanded', width ? 'true' : 'false');
		expect(await boxes()).toEqual(first);
	});
}

// Trevor (2026-10-26): Support and About had narrower text than Roadmap and Changelog. Every
// sidebar page shares Page's one width, so their main areas line up at every window size.
test('About, Credits and Support are as wide as Roadmap and Changelog', async ({ page }) => {
	// A desktop window, where the old narrow text width showed.
	await page.setViewportSize({ width: 1280, height: 800 });
	const widths: Record<string, number> = {};
	for (const path of ['/roadmap', '/changelog', '/about', '/credits', '/support']) {
		await page.goto(path);
		const main = page.getByRole('main');
		await expect(main.getByRole('heading', { level: 1 })).toBeVisible();
		const box = (await main.boundingBox())!;
		widths[path] = Math.round(box.width);
	}
	expect(widths['/about']).toBe(widths['/roadmap']);
	expect(widths['/credits']).toBe(widths['/roadmap']);
	expect(widths['/support']).toBe(widths['/roadmap']);
	expect(widths['/changelog']).toBe(widths['/roadmap']);
});

// Trevor (2026-11-10, C2): the head (buttons, title, byline) sits on a raised band with a line
// along its foot, as the bottom tab bar does, ending in the gap above the content.
test('the page head sits on a raised band that ends above the content', async ({
	page
}, testInfo) => {
	await page.goto('/spikes/page');
	const main = page.getByRole('main');
	const band = main.locator('.head-band');
	const look = await band.evaluate((node) => {
		const style = getComputedStyle(node);
		const probe = document.createElement('i');
		probe.style.color = 'var(--surface-raised)';
		node.append(probe);
		const raised = getComputedStyle(probe).color;
		probe.remove();
		return { fill: style.backgroundColor, raised, line: style.borderBottomWidth };
	});
	expect(look.fill).toBe(look.raised);
	expect(look.line).toBe('1px');
	const head = (await band.boundingBox())!;
	const subtitle = (await main.getByText('Subtitle line').boundingBox())!;
	const search = (await main.getByRole('searchbox', { name: 'Search' }).boundingBox())!;
	expect(subtitle.y + subtitle.height).toBeLessThanOrEqual(head.y + head.height + 1);
	expect(search.y).toBeGreaterThan(head.y + head.height);
	// Trevor (2026-11-12, B): a phone's row of text buttons sits under the line, not in the band.
	const action = (await main.getByRole('button', { name: 'Action' }).boundingBox())!;
	if (testInfo.project.name === 'phone') expect(action.y).toBeGreaterThan(head.y + head.height);
	else expect(action.y + action.height).toBeLessThanOrEqual(head.y + head.height);
});

// Trevor (2026-11-12): "header is not always same on every screen, it sometimes is bigger,
// like on the join screen". The band holds the title, and a byline only once it has words, so
// Join's free byline line and the Library's buttons stay under it (B).
test('the band is as tall on Join and the Library as on a page with only a title', async ({
	page
}) => {
	const bandHeight = async (path: string, title: string) => {
		await page.goto(path);
		await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
		return (await page.getByRole('main').locator('.head-band').boundingBox())!.height;
	};
	const about = await bandHeight('/about', 'About');
	expect(await bandHeight('/join', 'Join game')).toBeCloseTo(about, 0);
	expect(await bandHeight('/library', 'Library')).toBeCloseTo(about, 0);
});
