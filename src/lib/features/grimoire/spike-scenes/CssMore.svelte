<script lang="ts" module>
	export type CssMoreScene =
		| 'lava'
		| 'underwater'
		| 'stars'
		| 'aurora'
		| 'storm'
		| 'fog'
		| 'snow'
		| 'sunset'
		| 'fireflies'
		| 'void';
</script>

<script lang="ts">
	/**
	 * SPIKE (animated backgrounds, not for merge). Ten more scenes drawn and moved in CSS
	 * only, after CssScene.svelte: every moving layer animates `transform` or `opacity`, so the
	 * compositor does the work and nothing is painted again frame by frame. Glows are static
	 * gradients and static blur; long drifts are oversized layers that translate or rotate.
	 */
	interface Props {
		scene: CssMoreScene;
		/** Still: the scene's resting frame (reduced motion, or the switch off). */
		still?: boolean;
		contained?: boolean;
	}
	let { scene, still = false, contained = false }: Props = $props();

	// A fixed scatter, so every render (and every screenshot) is the same.
	const rand = (i: number, salt: number) => {
		const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
		return x - Math.floor(x);
	};
	const range = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));
	const f1 = (n: number) => n.toFixed(1);

	/** Twinkling points: a layer of stars or motes. */
	const points = (
		n: number,
		salt: number,
		size: [number, number],
		dur: [number, number],
		top: [number, number] = [0, 92]
	) =>
		range(n, (i) => ({
			left: rand(i, salt) * 100,
			top: top[0] + rand(i, salt + 1) * (top[1] - top[0]),
			size: size[0] + rand(i, salt + 2) * (size[1] - size[0]),
			dur: dur[0] + rand(i, salt + 3) * (dur[1] - dur[0]),
			delay: -rand(i, salt + 4) * dur[1]
		}));

	/** A silhouette ridge in a w by h viewBox, filled down to the bottom. */
	const ridgeY = (x: number, base: number, amp: number, salt: number) =>
		base -
		amp *
			(Math.sin(x * 0.05 + salt) * 0.6 +
				Math.sin(x * 0.13 + salt * 2.3) * 0.3 +
				Math.sin(x * 0.31 + salt * 1.7) * 0.1);
	const ridge = (w: number, h: number, base: number, amp: number, salt: number, steps = 48) => {
		let d = `M0 ${h}`;
		for (let s = 0; s <= steps; s++) {
			const x = (s / steps) * w;
			d += ` L${f1(x)} ${f1(ridgeY(x, base, amp, salt))}`;
		}
		return `${d} L${w} ${h} Z`;
	};
	/** A three-tier pine standing at (x, b), h tall. */
	const pine = (x: number, b: number, h: number) => {
		let d = '';
		for (let j = 0; j < 3; j++) {
			const top = b - h + j * h * 0.22;
			const bot = b - h * 0.45 + j * h * 0.22;
			const w = h * 0.32 * (0.55 + j * 0.25);
			d += `M${f1(x - w)} ${f1(bot)} L${f1(x)} ${f1(top)} L${f1(x + w)} ${f1(bot)} Z `;
		}
		return d;
	};
	/** A forest edge: pines along a ridge. */
	const treeline = (w: number, h: number, base: number, amp: number, salt: number, n: number) => {
		let d = ridge(w, h, base, amp, salt);
		for (let i = 0; i < n; i++) {
			const x = (i / n) * w + rand(i, salt + 1) * (w / n);
			d += ' ' + pine(x, ridgeY(x, base, amp, salt) + 1, 5 + rand(i, salt + 2) * 9);
		}
		return d;
	};

	// ── Lava: wandering crack lines, each a short random walk.
	const cracks = (salt: number, n: number) =>
		range(n, (i) => {
			let x = rand(i, salt) * 120 - 10;
			let y = rand(i, salt + 1) * 120 - 10;
			let a = rand(i, salt + 2) * Math.PI * 2;
			let d = `M${f1(x)} ${f1(y)}`;
			for (let s = 0; s < 7; s++) {
				a += (rand(i * 7 + s, salt + 3) - 0.5) * 1.4;
				const len = 3 + rand(i * 7 + s, salt + 4) * 6;
				x += Math.cos(a) * len;
				y += Math.sin(a) * len;
				d += ` L${f1(x)} ${f1(y)}`;
			}
			return d;
		});
	const crackSets = [
		{ paths: cracks(30, 22), cls: 'near' },
		{ paths: cracks(40, 16), cls: 'far' }
	];
	const blobs = range(14, (i) => ({
		left: rand(i, 20) * 100,
		top: rand(i, 21) * 100,
		size: 18 + rand(i, 22) * 30,
		dur: 14 + rand(i, 23) * 14,
		delay: -rand(i, 24) * 28,
		dx: (rand(i, 25) - 0.5) * 18,
		dy: (rand(i, 26) - 0.5) * 18
	}));

	// ── Underwater
	const rays = range(7, (i) => ({
		left: 2 + i * 14 + rand(i, 50) * 6,
		width: 7 + rand(i, 51) * 9,
		tilt: 8 + rand(i, 52) * 10,
		dur: 9 + rand(i, 53) * 7,
		delay: -rand(i, 54) * 16
	}));
	const bubbles = range(24, (i) => ({
		left: rand(i, 55) * 100,
		size: 0.6 + rand(i, 56) * 1.6,
		dur: 9 + rand(i, 57) * 9,
		delay: -rand(i, 58) * 18,
		amp: 0.6 + rand(i, 59) * 1.6,
		sway: 1.6 + rand(i, 60) * 1.6
	}));
	const kelp = range(10, (i) => {
		const x = 4 + i * 20 + rand(i, 61) * 10;
		const top = 18 + rand(i, 62) * 20;
		const lean = (rand(i, 63) - 0.5) * 8;
		return {
			d: `M${f1(x)} 60 Q${f1(x + 5 + lean)} ${f1((60 + top) / 2 + 6)} ${f1(x + lean / 2)} ${f1((60 + top) / 2)} T${f1(x + lean)} ${f1(top)}`,
			dur: 4 + rand(i, 64) * 4,
			delay: -rand(i, 65) * 8
		};
	});

	// ── Starry night
	const starsFar = points(46, 70, [0.16, 0.3], [3, 7]);
	const starsMid = points(30, 80, [0.3, 0.5], [2.5, 6]);
	const starsNear = points(14, 90, [0.5, 0.8], [2, 5], [4, 80]);

	// ── Aurora: three curtains, each a run of slices rippling in a travelling wave.
	const auroraStars = points(40, 100, [0.15, 0.35], [2.5, 6], [0, 62]);
	const curtains = range(3, (c) => ({
		base: [60, 54, 48][c],
		height: [34, 30, 26][c],
		hue: [150, 165, 180][c],
		dur: 34 + c * 9,
		delay: -c * 11,
		segs: range(9, (s) => ({
			left: -12 + s * 14 + rand(s, 110 + c) * 4,
			lift: (rand(s, 120 + c) - 0.5) * 6,
			dur: 8 + rand(s, 130 + c) * 3,
			delay: -(s * 0.9 + c * 2.3)
		}))
	}));
	const auroraLand = treeline(200, 40, 30, 4, 3.1, 64);

	// ── Thunderstorm
	const rain = range(80, (i) => {
		const far = i % 3 === 0;
		return {
			left: rand(i, 140) * 100,
			len: far ? 3 + rand(i, 141) * 3 : 5 + rand(i, 141) * 5,
			dur: far ? 0.9 + rand(i, 142) * 0.4 : 0.55 + rand(i, 142) * 0.3,
			delay: -rand(i, 143) * 1.4,
			far
		};
	});
	const stormLand = ridge(200, 30, 24, 4, 5.3);

	// ── Graveyard fog
	const fogStars = points(16, 150, [0.15, 0.3], [3, 7], [0, 45]);
	const graves = (() => {
		const stone = (x: number, b: number, h: number, w: number, kind: number) => {
			if (kind < 0.5)
				return `M${f1(x - w)} ${f1(b)} V${f1(b - h + w)} A${f1(w)} ${f1(w)} 0 0 1 ${f1(x + w)} ${f1(b - h + w)} V${f1(b)} Z`;
			if (kind < 0.75) {
				const t = w * 0.35;
				const arm = b - h * 0.72;
				return `M${f1(x - t)} ${f1(b)} V${f1(arm + t)} H${f1(x - w)} V${f1(arm - t)} H${f1(x - t)} V${f1(b - h)} H${f1(x + t)} V${f1(arm - t)} H${f1(x + w)} V${f1(arm + t)} H${f1(x + t)} V${f1(b)} Z`;
			}
			return `M${f1(x - w)} ${f1(b)} L${f1(x - w * 0.7)} ${f1(b - h * 0.8)} L${f1(x)} ${f1(b - h)} L${f1(x + w * 0.7)} ${f1(b - h * 0.8)} L${f1(x + w)} ${f1(b)} Z`;
		};
		const row = (n: number, salt: number, base: number, scale: number) => {
			let d = '';
			for (let i = 0; i < n; i++) {
				const x = (i + 0.3 + rand(i, salt) * 0.4) * (200 / n);
				const b = ridgeY(x, base, 1.5, salt) + 1;
				d += stone(
					x,
					b,
					(7 + rand(i, salt + 1) * 7) * scale,
					(2.5 + rand(i, salt + 2) * 1.5) * scale,
					rand(i, salt + 3)
				);
			}
			return d;
		};
		return {
			back: ridge(200, 60, 50, 1.5, 7.7) + row(12, 160, 50, 0.6),
			front: ridge(200, 60, 56, 1.5, 9.1) + row(9, 170, 56, 1)
		};
	})();

	// ── Snowfall: three depths of flakes.
	const flakes = [
		...range(40, (i) => ({
			i,
			depth: 'far',
			size: 0.3 + rand(i, 180) * 0.2,
			dur: 15 + rand(i, 181) * 8
		})),
		...range(26, (i) => ({
			i,
			depth: 'mid',
			size: 0.6 + rand(i, 182) * 0.3,
			dur: 10 + rand(i, 183) * 4
		})),
		...range(12, (i) => ({
			i,
			depth: 'near',
			size: 1.2 + rand(i, 184) * 0.7,
			dur: 6.5 + rand(i, 185) * 3
		}))
	].map((f, k) => ({
		...f,
		left: rand(k, 186) * 100,
		delay: -rand(k, 187) * f.dur,
		amp: 1 + rand(k, 188) * 2.5,
		sway: 2 + rand(k, 189) * 2.5,
		swayDelay: -rand(k, 190) * 4
	}));
	const snowHills = {
		far: treeline(200, 60, 34, 5, 2.2, 40),
		mid: ridge(200, 60, 44, 4, 4.4),
		near: ridge(200, 60, 52, 3, 6.6)
	};

	// ── Sunset
	const sunsetLand = treeline(200, 30, 20, 3, 8.8, 26);
	const birds = range(3, (i) => ({
		top: 22 + i * 7 + rand(i, 200) * 4,
		dur: 50 + rand(i, 201) * 25,
		delay: -rand(i, 202) * 70,
		flap: 0.7 + rand(i, 203) * 0.4
	}));

	// ── Firefly wood
	const trunksBack = range(9, (i) => {
		const x = 4 + i * 11.5 + rand(i, 210) * 5;
		const w = 1 + rand(i, 211) * 1.2;
		return `M${f1(x - w)} 100 L${f1(x - w * 0.7)} 0 L${f1(x + w * 0.7)} 0 L${f1(x + w)} 100 Z`;
	}).join(' ');
	const trunksFront = [6, 31, 72, 94]
		.map((x, i) => {
			const w = 2.4 + rand(i, 212) * 1.8;
			return `M${f1(x - w * 1.9)} 100 Q${f1(x - w)} 94 ${f1(x - w)} 84 L${f1(x - w * 0.75)} 0 L${f1(x + w * 0.75)} 0 L${f1(x + w)} 84 Q${f1(x + w)} 94 ${f1(x + w * 1.9)} 100 Z`;
		})
		.join(' ');
	const undergrowth = (() => {
		let d = ridge(200, 40, 30, 3, 1.9, 60);
		for (let i = 0; i < 46; i++) {
			const x = i * 4.4 + rand(i, 220) * 3;
			const b = ridgeY(x, 30, 3, 1.9) + 1;
			const h = 4 + rand(i, 221) * 7;
			const lean = (rand(i, 222) - 0.5) * 5;
			d += ` M${f1(x - 0.6)} ${f1(b)} Q${f1(x + lean * 0.3)} ${f1(b - h * 0.6)} ${f1(x + lean)} ${f1(b - h)} Q${f1(x + lean * 0.3 + 0.8)} ${f1(b - h * 0.5)} ${f1(x + 0.6)} ${f1(b)} Z`;
		}
		return d;
	})();
	const fireflies = range(30, (i) => {
		const r = (s: number) => (rand(i, s) - 0.5) * 22;
		return {
			left: rand(i, 230) * 100,
			top: 28 + rand(i, 231) * 66,
			size: 1.6 + rand(i, 232) * 1.2,
			dur: 16 + rand(i, 233) * 16,
			delay: -rand(i, 234) * 32,
			x1: r(235),
			y1: r(236),
			x2: r(237),
			y2: r(238),
			x3: r(239),
			y3: r(240),
			blink: 2.5 + rand(i, 241) * 3.5,
			blinkDelay: -rand(i, 242) * 6
		};
	});

	// ── Arcane void: spiral arms and orbiting motes.
	const spiral = (arms: number, curl: number, salt: number) =>
		range(arms, (k) => {
			const t0 = (k / arms) * Math.PI * 2 + rand(k, salt) * 0.4;
			let d = '';
			for (let s = 0; s <= 40; s++) {
				const r = 3 + s * 1.15;
				const t = t0 + curl * r * 0.09;
				d += `${s ? ' L' : 'M'}${f1(Math.cos(t) * r)} ${f1(Math.sin(t) * r)}`;
			}
			return d;
		});
	const armsWide = spiral(5, 1, 250);
	const armsThin = spiral(3, -1.3, 260);
	const motes = range(40, (i) => ({
		r: 8 + rand(i, 270) * 52,
		start: rand(i, 271) * 360,
		size: 0.3 + rand(i, 272) * 0.45,
		dur: 30 + rand(i, 273) * 50,
		delay: -rand(i, 274) * 80,
		reverse: rand(i, 275) < 0.3,
		tw: 2 + rand(i, 276) * 4,
		twDelay: -rand(i, 277) * 6
	}));
</script>

{#snippet twinklers(list: ReturnType<typeof points>, cls: string)}
	{#each list as s, i (i)}
		<span
			class="pt {cls}"
			style:left="{s.left}%"
			style:top="{s.top}%"
			style:--size="{s.size}vmin"
			style:animation-duration="{s.dur}s"
			style:animation-delay="{s.delay}s"
		></span>
	{/each}
{/snippet}

<div class="scene {scene}" class:still class:contained aria-hidden="true">
	{#if scene === 'lava'}
		<div class="crust"></div>
		{#each blobs as b, i (i)}
			<div
				class="blob"
				style:left="{b.left}%"
				style:top="{b.top}%"
				style:--size="{b.size}vmin"
				style:--dx="{b.dx}vmin"
				style:--dy="{b.dy}vmin"
				style:animation-duration="{b.dur}s, {b.dur / 3}s"
				style:animation-delay="{b.delay}s"
			></div>
		{/each}
		{#each crackSets as set (set.cls)}
			<div class="cracks {set.cls}">
				<svg class="cglow" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
					{#each set.paths as d, i (i)}<path {d} />{/each}
				</svg>
				<svg class="ccore" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
					{#each set.paths as d, i (i)}<path {d} />{/each}
				</svg>
			</div>
		{/each}
		<div class="heat"></div>
	{:else if scene === 'underwater'}
		<div class="water"></div>
		<div class="surface"></div>
		<div class="caustics">
			<div class="cx c1"></div>
			<div class="cx c2"></div>
		</div>
		{#each rays as r, i (i)}
			<div
				class="ray"
				style:left="{r.left}%"
				style:width="{r.width}%"
				style:--tilt="{r.tilt}deg"
				style:animation-duration="{r.dur}s"
				style:animation-delay="{r.delay}s"
			></div>
		{/each}
		<svg class="seabed" viewBox="0 0 200 60" preserveAspectRatio="xMidYMax slice">
			{#each kelp as k, i (i)}
				<path
					class="kelp"
					d={k.d}
					style:animation-duration="{k.dur}s"
					style:animation-delay="{k.delay}s"
				/>
			{/each}
			<path class="rocks" d={ridge(200, 60, 54, 4, 1.3)} />
		</svg>
		{#each bubbles as b, i (i)}
			<span
				class="bubble"
				style:left="{b.left}%"
				style:--size="{b.size}vmin"
				style:--amp="{b.amp}vmin"
				style:--sway="{b.sway}s"
				style:animation-duration="{b.dur}s"
				style:animation-delay="{b.delay}s"
			></span>
		{/each}
	{:else if scene === 'stars'}
		<div class="night"></div>
		<div class="milky"></div>
		<div class="milky dust"></div>
		{@render twinklers(starsFar, 'far')}
		{@render twinklers(starsMid, 'mid')}
		{@render twinklers(starsNear, 'near')}
		<div class="meteor m1"><span></span></div>
		<div class="meteor m2"><span></span></div>
		<svg class="land" viewBox="0 0 200 30" preserveAspectRatio="xMidYMax slice">
			<path d={ridge(200, 30, 22, 4, 0.7)} />
		</svg>
	{:else if scene === 'aurora'}
		<div class="night"></div>
		{@render twinklers(auroraStars, 'far')}
		<div class="skyglow"></div>
		{#each curtains as c, ci (ci)}
			<div
				class="curtain"
				style:--hue={c.hue}
				style:animation-duration="{c.dur}s"
				style:animation-delay="{c.delay}s"
			>
				{#each c.segs as s, si (si)}
					<div
						class="seg"
						style:left="{s.left}%"
						style:top="{c.base - c.height + s.lift}%"
						style:height="{c.height}%"
						style:animation-duration="{s.dur}s"
						style:animation-delay="{s.delay}s"
					></div>
				{/each}
			</div>
		{/each}
		<svg class="land" viewBox="0 0 200 40" preserveAspectRatio="xMidYMax slice">
			<path d={auroraLand} />
		</svg>
	{:else if scene === 'storm'}
		<div class="sky"></div>
		<div class="clouds k1"></div>
		<div class="clouds k2"></div>
		<div class="rain">
			{#each rain as r, i (i)}
				<span
					class="drop"
					class:far={r.far}
					style:left="{r.left}%"
					style:height="{r.len}vh"
					style:animation-duration="{r.dur}s"
					style:animation-delay="{r.delay}s"
				></span>
			{/each}
		</div>
		<div class="clouds k3"></div>
		<div class="flash"></div>
		<svg class="bolt b1" viewBox="0 0 40 100" preserveAspectRatio="xMidYMin meet">
			<path d="M24 0 L15 28 L23 31 L11 60 L19 62 L6 100 M15 28 L5 42 M11 60 L3 70" />
		</svg>
		<svg class="bolt b2" viewBox="0 0 40 100" preserveAspectRatio="xMidYMin meet">
			<path d="M16 0 L25 24 L17 27 L29 55 L21 57 L32 88 M25 24 L35 36" />
		</svg>
		<svg class="land" viewBox="0 0 200 30" preserveAspectRatio="xMidYMax slice">
			<path d={stormLand} />
		</svg>
	{:else if scene === 'fog'}
		<div class="sky"></div>
		{@render twinklers(fogStars, 'far')}
		<div class="moonglow"></div>
		<div class="moon"></div>
		<svg class="hill" viewBox="0 0 200 60" preserveAspectRatio="xMidYMax slice">
			<path d={ridge(200, 60, 38, 6, 3.3)} />
		</svg>
		<div class="mist m1"></div>
		<svg class="yard back" viewBox="0 0 200 60" preserveAspectRatio="xMidYMax slice">
			<path d={graves.back} />
		</svg>
		<div class="mist m2"></div>
		<svg class="yard front" viewBox="0 0 200 60" preserveAspectRatio="xMidYMax slice">
			<path d={graves.front} />
			<path
				class="tree"
				d="M178 57 C 177 46, 179 38, 176 28 M177 40 C 171 36, 168 33, 163 32 M176 33 C 182 28, 186 27, 190 22 M176 28 C 174 22, 172 20, 170 16 M171 34 L 166 28"
			/>
		</svg>
		<div class="mist m3"></div>
	{:else if scene === 'snow'}
		<div class="sky"></div>
		<div class="haze"></div>
		<svg class="hills far" viewBox="0 0 200 60" preserveAspectRatio="xMidYMax slice">
			<path d={snowHills.far} />
		</svg>
		{#each flakes.filter((f) => f.depth === 'far') as f (f.i)}
			{@render flake(f)}
		{/each}
		<svg class="hills mid" viewBox="0 0 200 60" preserveAspectRatio="xMidYMax slice">
			<path d={snowHills.mid} />
		</svg>
		{#each flakes.filter((f) => f.depth === 'mid') as f (f.i)}
			{@render flake(f)}
		{/each}
		<svg class="hills near" viewBox="0 0 200 60" preserveAspectRatio="xMidYMax slice">
			<path d={snowHills.near} />
		</svg>
		{#each flakes.filter((f) => f.depth === 'near') as f (f.i)}
			{@render flake(f)}
		{/each}
	{:else if scene === 'sunset'}
		<div class="sky"></div>
		<div class="sunglow"></div>
		<div class="sun"></div>
		<div class="clouds high"></div>
		<div class="clouds low"></div>
		{#each birds as b, i (i)}
			<div
				class="bird"
				style:top="{b.top}%"
				style:animation-duration="{b.dur}s"
				style:animation-delay="{b.delay}s"
			>
				<svg viewBox="0 0 20 8" style:animation-duration="{b.flap}s">
					<path d="M0 2 Q5 0 10 6 Q15 0 20 2 Q15 2 10 8 Q5 2 0 2Z" />
				</svg>
			</div>
		{/each}
		<svg class="land" viewBox="0 0 200 30" preserveAspectRatio="xMidYMax slice">
			<path d={sunsetLand} />
		</svg>
	{:else if scene === 'fireflies'}
		<div class="sky"></div>
		<div class="moonlight"></div>
		<svg class="trunks back" viewBox="0 0 100 100" preserveAspectRatio="none">
			<path d={trunksBack} />
		</svg>
		<div class="groundmist"></div>
		<svg class="trunks front" viewBox="0 0 100 100" preserveAspectRatio="none">
			<path d={trunksFront} />
		</svg>
		<svg class="brush" viewBox="0 0 200 40" preserveAspectRatio="xMidYMax slice">
			<path d={undergrowth} />
		</svg>
		{#each fireflies as f, i (i)}
			<span
				class="fly"
				style:left="{f.left}%"
				style:top="{f.top}%"
				style:--size="{f.size}vmin"
				style:--x1="{f.x1}vmin"
				style:--y1="{f.y1}vmin"
				style:--x2="{f.x2}vmin"
				style:--y2="{f.y2}vmin"
				style:--x3="{f.x3}vmin"
				style:--y3="{f.y3}vmin"
				style:--blink="{f.blink}s"
				style:--blink-delay="{f.blinkDelay}s"
				style:animation-duration="{f.dur}s"
				style:animation-delay="{f.delay}s"
			></span>
		{/each}
	{:else}
		<div class="abyss"></div>
		<div class="swirl conic"></div>
		<svg class="swirl wide" viewBox="-50 -50 100 100">
			{#each armsWide as d, i (i)}<path {d} />{/each}
		</svg>
		<svg class="swirl thin" viewBox="-50 -50 100 100">
			{#each armsThin as d, i (i)}<path {d} />{/each}
		</svg>
		<svg class="swirl runes" viewBox="-50 -50 100 100">
			<circle r="30" />
			<circle class="dash" r="27" />
		</svg>
		<div class="core"></div>
		<div class="spark"></div>
		{#each motes as m, i (i)}
			<div
				class="orbit"
				style:rotate="{m.start}deg"
				style:animation-duration="{m.dur}s"
				style:animation-delay="{m.delay}s"
				style:animation-direction={m.reverse ? 'reverse' : 'normal'}
			>
				<span
					style:--r="{m.r}vmin"
					style:--size="{m.size}vmin"
					style:animation-duration="{m.tw}s"
					style:animation-delay="{m.twDelay}s"
				></span>
			</div>
		{/each}
	{/if}
</div>

{#snippet flake(f: (typeof flakes)[number])}
	<span
		class="flake {f.depth}"
		style:left="{f.left}%"
		style:--size="{f.size}vmin"
		style:--amp="{f.amp}vmin"
		style:--sway="{f.sway}s"
		style:--sway-delay="{f.swayDelay}s"
		style:animation-duration="{f.dur}s"
		style:animation-delay="{f.delay}s"
	></span>
{/snippet}

<style>
	.scene {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
		/* Dimmed like an image, so seat names and labels stay readable. */
		filter: brightness(0.6) saturate(0.95);
		contain: strict;
	}
	.contained {
		position: absolute;
	}
	.scene > * {
		position: absolute;
	}
	.still *,
	.still *::before,
	.still *::after {
		animation-play-state: paused !important;
	}
	svg {
		overflow: visible;
	}

	/* Shared pieces: twinkling points, silhouettes along the bottom. */
	.pt {
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		background: oklch(0.95 0.02 260);
		animation: twinkle ease-in-out infinite alternate;
	}
	.pt.mid {
		background: oklch(0.96 0.03 230);
	}
	.pt.near {
		background: radial-gradient(circle, oklch(0.99 0.02 90) 30%, oklch(0.9 0.05 250 / 0) 72%);
		transform: scale(2.2);
	}
	.pt.near::before,
	.pt.near::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 400%;
		height: 12%;
		translate: -50% -50%;
		background: linear-gradient(to right, transparent, oklch(0.95 0.03 250 / 0.8), transparent);
	}
	.pt.near::after {
		rotate: 90deg;
	}
	.land {
		left: 0;
		bottom: 0;
		width: 100%;
		height: 18%;
		fill: oklch(0.08 0.02 280);
	}
	@keyframes twinkle {
		from {
			opacity: 0.12;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes pulse {
		from {
			opacity: 0.6;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	/* One tile of a 300% wide repeating layer slides past: a seamless loop. */
	@keyframes loopx {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(-33.3333%);
		}
	}
	@keyframes sway {
		from {
			transform: translateX(calc(var(--amp) * -1));
		}
		to {
			transform: translateX(var(--amp));
		}
	}

	/* ── Lava flow ── */
	.lava .crust {
		inset: 0;
		background:
			radial-gradient(ellipse 40% 30% at 20% 30%, oklch(0.22 0.05 30 / 0.7), transparent 70%),
			radial-gradient(ellipse 35% 40% at 80% 60%, oklch(0.2 0.05 25 / 0.6), transparent 70%),
			radial-gradient(ellipse 50% 30% at 40% 85%, oklch(0.24 0.07 35 / 0.6), transparent 70%),
			linear-gradient(to bottom, oklch(0.1 0.02 25), oklch(0.15 0.04 28));
	}
	.blob {
		width: var(--size);
		height: var(--size);
		translate: -50% -50%;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			oklch(0.82 0.17 70 / 0.7) 0%,
			oklch(0.62 0.21 40 / 0.45) 35%,
			transparent 70%
		);
		mix-blend-mode: screen;
		animation:
			ooze ease-in-out infinite alternate,
			pulse ease-in-out infinite alternate;
	}
	.cracks {
		inset: -15%;
		animation: drift 70s ease-in-out infinite alternate;
	}
	.cracks.far {
		opacity: 0.55;
		animation-duration: 95s;
		animation-direction: alternate-reverse;
	}
	.cracks svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.cglow {
		stroke: oklch(0.66 0.21 40);
		stroke-width: 2.4;
		filter: blur(1.4vmin);
		animation: pulse 3.6s ease-in-out infinite alternate;
	}
	.ccore {
		stroke: oklch(0.9 0.15 80);
		stroke-width: 0.5;
		animation: pulse 2.3s ease-in-out -1s infinite alternate;
	}
	.far .cglow {
		animation-duration: 4.4s;
		animation-delay: -2s;
	}
	.far .ccore {
		stroke-width: 0.35;
		animation-duration: 3.1s;
	}
	.heat {
		inset: 40% -20% -20%;
		background: radial-gradient(
			ellipse 60% 55% at 50% 100%,
			oklch(0.6 0.2 38 / 0.45),
			transparent 70%
		);
		animation: pulse 5s ease-in-out infinite alternate;
	}
	@keyframes ooze {
		from {
			transform: translate(0, 0) scale(0.85);
		}
		to {
			transform: translate(var(--dx), var(--dy)) scale(1.15);
		}
	}
	@keyframes drift {
		from {
			transform: translate(-3%, -2%) rotate(-2deg);
		}
		to {
			transform: translate(3%, 2%) rotate(2deg);
		}
	}

	/* ── Underwater ── */
	.water {
		inset: 0;
		background: linear-gradient(
			to bottom,
			oklch(0.5 0.09 215) 0%,
			oklch(0.34 0.08 230) 35%,
			oklch(0.2 0.06 245) 75%,
			oklch(0.13 0.04 255) 100%
		);
	}
	.surface {
		inset: -10% -20% 60%;
		background: radial-gradient(
			ellipse 60% 60% at 50% 0%,
			oklch(0.82 0.08 200 / 0.55),
			transparent 70%
		);
	}
	/* Two grids of soft rings sliding across each other make a shifting caustic net. */
	.caustics {
		inset: 0 0 30% 0;
		overflow: hidden;
		mask-image: linear-gradient(to bottom, black, transparent);
	}
	.cx {
		position: absolute;
		inset: -50%;
		filter: blur(0.3vmin);
		mix-blend-mode: screen;
	}
	.c1 {
		background:
			radial-gradient(closest-side, transparent 62%, oklch(0.88 0.08 195 / 0.3) 80%, transparent),
			radial-gradient(closest-side, transparent 58%, oklch(0.88 0.08 195 / 0.22) 78%, transparent);
		background-size:
			17vmin 13vmin,
			23vmin 19vmin;
		background-position:
			0 0,
			7vmin 5vmin;
		animation:
			caustic-a 26s ease-in-out infinite alternate,
			pulse 3.4s ease-in-out infinite alternate;
	}
	.c2 {
		background: radial-gradient(
			closest-side,
			transparent 60%,
			oklch(0.9 0.07 190 / 0.25) 80%,
			transparent
		);
		background-size: 29vmin 21vmin;
		animation:
			caustic-b 34s ease-in-out infinite alternate,
			pulse 4.1s ease-in-out -2s infinite alternate;
	}
	.ray {
		top: -8%;
		height: 100%;
		transform-origin: 50% 0;
		background: linear-gradient(
			to bottom,
			oklch(0.9 0.07 195 / 0.38),
			oklch(0.8 0.08 205 / 0.12) 55%,
			transparent 85%
		);
		filter: blur(1.6vmin);
		mix-blend-mode: screen;
		animation: ray ease-in-out infinite alternate;
	}
	.seabed {
		left: 0;
		bottom: 0;
		width: 100%;
		height: 26%;
	}
	.rocks {
		fill: oklch(0.1 0.03 250);
	}
	.kelp {
		fill: none;
		stroke: oklch(0.16 0.05 190);
		stroke-width: 1.8;
		stroke-linecap: round;
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: kelp ease-in-out infinite alternate;
	}
	.bubble {
		bottom: -3vh;
		width: var(--size);
		height: var(--size);
		animation: rise linear infinite;
	}
	.bubble::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: radial-gradient(
			circle at 35% 30%,
			oklch(0.98 0.02 200 / 0.9) 0 12%,
			oklch(0.85 0.06 200 / 0.12) 40%,
			oklch(0.9 0.06 200 / 0.55) 68%,
			transparent 72%
		);
		animation: sway var(--sway) ease-in-out infinite alternate;
	}
	@keyframes caustic-a {
		from {
			transform: translate(-4%, -3%) rotate(-6deg);
		}
		to {
			transform: translate(4%, 3%) rotate(6deg);
		}
	}
	@keyframes caustic-b {
		from {
			transform: translate(5%, 2%) rotate(8deg) scale(1.05);
		}
		to {
			transform: translate(-5%, -2%) rotate(-4deg) scale(0.95);
		}
	}
	@keyframes ray {
		0% {
			transform: rotate(var(--tilt)) scaleX(0.8);
			opacity: 0.4;
		}
		100% {
			transform: rotate(calc(var(--tilt) - 7deg)) scaleX(1.15);
			opacity: 1;
		}
	}
	@keyframes kelp {
		from {
			transform: rotate(-4deg) skewX(-3deg);
		}
		to {
			transform: rotate(4deg) skewX(3deg);
		}
	}
	@keyframes rise {
		0% {
			transform: translateY(0);
			opacity: 0;
		}
		8% {
			opacity: 1;
		}
		85% {
			opacity: 0.8;
		}
		100% {
			transform: translateY(-106vh);
			opacity: 0;
		}
	}

	/* ── Starry night ── */
	.stars .night {
		inset: 0;
		background: linear-gradient(
			to bottom,
			oklch(0.08 0.02 275) 0%,
			oklch(0.13 0.04 285) 60%,
			oklch(0.2 0.06 295) 100%
		);
	}
	.milky {
		left: -40%;
		width: 180%;
		top: 28%;
		height: 38%;
		rotate: -24deg;
		background:
			radial-gradient(ellipse 50% 32% at 50% 50%, oklch(0.42 0.08 290 / 0.45), transparent 70%),
			radial-gradient(ellipse 30% 20% at 35% 46%, oklch(0.5 0.06 260 / 0.3), transparent 70%),
			radial-gradient(ellipse 26% 16% at 66% 54%, oklch(0.5 0.07 310 / 0.3), transparent 70%);
		filter: blur(2vmin);
		animation: pulse 14s ease-in-out infinite alternate;
	}
	.milky.dust {
		background:
			radial-gradient(ellipse 6% 10% at 22% 48%, oklch(0.7 0.04 260 / 0.25), transparent 70%),
			radial-gradient(ellipse 8% 9% at 41% 55%, oklch(0.7 0.04 280 / 0.22), transparent 70%),
			radial-gradient(ellipse 5% 12% at 58% 44%, oklch(0.7 0.04 300 / 0.25), transparent 70%),
			radial-gradient(ellipse 9% 8% at 76% 52%, oklch(0.7 0.04 260 / 0.2), transparent 70%),
			radial-gradient(ellipse 30% 4% at 50% 52%, oklch(0.06 0.02 280 / 0.6), transparent 70%);
		filter: blur(1vmin);
		animation-duration: 19s;
		animation-delay: -7s;
	}
	/* A shooting star every 6s: two meteors on a 12s cycle, half a cycle apart. */
	.meteor {
		width: 0;
		height: 0;
		rotate: 156deg;
	}
	.m1 {
		left: 86%;
		top: 12%;
	}
	.m2 {
		left: 34%;
		top: 38%;
	}
	.meteor span {
		position: absolute;
		right: 0;
		top: 0;
		width: 18vmin;
		height: 0.25vmin;
		border-radius: 1vmin;
		background: linear-gradient(to right, transparent, oklch(0.98 0.03 90));
		opacity: 0;
		animation: meteor 12s linear infinite;
	}
	.m1 span {
		animation-delay: -3s;
	}
	.m2 span {
		animation-delay: -9s;
	}
	@keyframes meteor {
		0% {
			transform: translateX(0);
			opacity: 0;
		}
		1% {
			opacity: 1;
		}
		7% {
			transform: translateX(48vmin);
			opacity: 0;
		}
		100% {
			transform: translateX(48vmin);
			opacity: 0;
		}
	}

	/* ── Aurora ── */
	.aurora .night {
		inset: 0;
		background: linear-gradient(
			to bottom,
			oklch(0.06 0.02 250) 0%,
			oklch(0.1 0.03 220) 60%,
			oklch(0.15 0.04 200) 100%
		);
	}
	.skyglow {
		inset: 30% -20% 0;
		background: radial-gradient(
			ellipse 60% 40% at 50% 70%,
			oklch(0.45 0.1 160 / 0.25),
			transparent 70%
		);
	}
	.curtain {
		inset: 0 -10%;
		mix-blend-mode: screen;
		animation: curtain ease-in-out infinite alternate;
	}
	.seg {
		position: absolute;
		width: 17%;
		transform-origin: 50% 100%;
		background:
			repeating-linear-gradient(
				to right,
				transparent 0 0.6vmin,
				oklch(0.95 0.1 calc(var(--hue) * 1) / 0.12) 0.9vmin,
				transparent 1.4vmin 2.2vmin
			),
			linear-gradient(
				to top,
				transparent 0%,
				oklch(0.78 0.19 calc(var(--hue) * 1) / 0.75) 6%,
				oklch(0.7 0.17 calc(var(--hue) + 10) / 0.45) 26%,
				oklch(0.58 0.16 calc(var(--hue) + 50) / 0.3) 50%,
				oklch(0.5 0.18 300 / 0.2) 72%,
				transparent 100%
			);
		border-radius: 40% 40% 10% 10% / 60% 60% 6% 6%;
		filter: blur(1.6vmin);
		animation: ripple ease-in-out infinite alternate;
	}
	.aurora .land {
		height: 24%;
		fill: oklch(0.05 0.015 210);
	}
	@keyframes curtain {
		from {
			transform: translateX(-6%);
		}
		to {
			transform: translateX(6%);
		}
	}
	@keyframes ripple {
		0% {
			transform: translateY(-3vh) scaleY(0.88) skewX(-8deg);
			opacity: 0.5;
		}
		100% {
			transform: translateY(2vh) scaleY(1.1) skewX(7deg);
			opacity: 1;
		}
	}

	/* ── Thunderstorm ── */
	.storm .sky {
		inset: 0;
		background: linear-gradient(
			to bottom,
			oklch(0.22 0.02 255) 0%,
			oklch(0.15 0.02 255) 55%,
			oklch(0.1 0.015 250) 100%
		);
	}
	.clouds {
		left: 0;
		width: 300%;
		background-repeat: repeat-x;
		background-size: 33.3333% 100%;
		animation: loopx linear infinite;
	}
	.storm .clouds {
		background-image:
			radial-gradient(ellipse 26% 50% at 22% 40%, var(--c), transparent 70%),
			radial-gradient(ellipse 22% 40% at 48% 55%, var(--c), transparent 70%),
			radial-gradient(ellipse 26% 46% at 76% 38%, var(--c), transparent 70%),
			linear-gradient(to bottom, var(--c), transparent 60%);
		filter: blur(1.4vmin);
	}
	.k1 {
		--c: oklch(0.3 0.02 255 / 0.8);
		top: -6%;
		height: 50%;
		animation-duration: 120s;
	}
	.k2 {
		--c: oklch(0.24 0.02 255 / 0.85);
		top: 4%;
		height: 42%;
		background-position: 40% 0;
		animation-duration: 80s;
	}
	.k3 {
		--c: oklch(0.17 0.015 255 / 0.9);
		top: -10%;
		height: 32%;
		background-position: 70% 0;
		animation-duration: 55s;
	}
	.rain {
		inset: -25%;
		rotate: 14deg;
	}
	.drop {
		position: absolute;
		top: 0;
		width: 0.16vmin;
		background: linear-gradient(to bottom, transparent, oklch(0.8 0.03 240 / 0.6));
		animation: fall linear infinite;
		--fall: 170vh;
	}
	.drop.far {
		width: 0.1vmin;
		opacity: 0.45;
	}
	.flash {
		inset: 0;
		background: radial-gradient(
			ellipse 90% 70% at 30% 10%,
			oklch(0.85 0.04 260 / 0.75),
			oklch(0.6 0.04 260 / 0.25) 60%,
			transparent
		);
		opacity: 0;
		animation: flash 10s linear infinite;
	}
	.bolt {
		top: 0;
		height: 55%;
		width: 16%;
		fill: none;
		stroke: oklch(0.97 0.03 260);
		stroke-width: 0.8;
		stroke-linejoin: round;
		filter: drop-shadow(0 0 1vmin oklch(0.8 0.08 260));
		opacity: 0;
		animation: bolt-a 10s linear infinite;
	}
	.b1 {
		left: 6%;
	}
	.b2 {
		right: 6%;
		height: 45%;
		animation-name: bolt-b;
	}
	.storm .land {
		height: 14%;
		fill: oklch(0.07 0.01 250);
	}
	@keyframes fall {
		from {
			transform: translateY(-10vh);
		}
		to {
			transform: translateY(var(--fall));
		}
	}
	@keyframes flash {
		0%,
		7%,
		50%,
		54.5%,
		100% {
			opacity: 0;
		}
		1% {
			opacity: 0.9;
		}
		2.5% {
			opacity: 0.15;
		}
		3.5% {
			opacity: 0.65;
		}
		51% {
			opacity: 0.5;
		}
	}
	@keyframes bolt-a {
		0%,
		5.5%,
		100% {
			opacity: 0;
		}
		1% {
			opacity: 1;
		}
		2.5% {
			opacity: 0.2;
		}
		3.5% {
			opacity: 0.9;
		}
	}
	@keyframes bolt-b {
		0%,
		50%,
		53.5%,
		100% {
			opacity: 0;
		}
		51% {
			opacity: 0.85;
		}
	}

	/* ── Graveyard fog ── */
	.fog .sky {
		inset: 0;
		background: linear-gradient(
			to bottom,
			oklch(0.26 0.03 205) 0%,
			oklch(0.18 0.025 200) 55%,
			oklch(0.12 0.02 195) 100%
		);
	}
	.moonglow {
		left: calc(18% - 35vmin);
		top: calc(14% - 35vmin);
		width: 70vmin;
		height: 70vmin;
		border-radius: 50%;
		background: radial-gradient(circle, oklch(0.7 0.04 190 / 0.4), transparent 65%);
		animation: pulse 7s ease-in-out infinite alternate;
	}
	.moon {
		left: calc(18% - 7vmin);
		top: calc(14% - 7vmin);
		width: 14vmin;
		height: 14vmin;
		border-radius: 50%;
		background:
			radial-gradient(circle at 34% 40%, oklch(0.8 0.02 110 / 0.6) 0 10%, transparent 12%),
			radial-gradient(circle at 62% 62%, oklch(0.82 0.02 110 / 0.5) 0 14%, transparent 16%),
			radial-gradient(circle at 60% 30%, oklch(0.84 0.02 110 / 0.5) 0 6%, transparent 8%),
			radial-gradient(circle, oklch(0.94 0.03 105) 0 66%, oklch(0.88 0.03 105 / 0) 71%);
	}
	.hill {
		left: 0;
		bottom: 0;
		width: 100%;
		height: 34%;
		fill: oklch(0.13 0.02 200);
	}
	.yard {
		left: 0;
		bottom: 0;
		width: 100%;
		height: 30%;
	}
	.yard.back {
		fill: oklch(0.1 0.02 200);
	}
	.yard.front {
		fill: oklch(0.04 0.01 200);
	}
	.tree {
		fill: none;
		stroke: oklch(0.04 0.01 200);
		stroke-width: 1.4;
		stroke-linecap: round;
	}
	.mist {
		left: 0;
		width: 300%;
		background-image:
			radial-gradient(ellipse 28% 50% at 22% 60%, var(--c), transparent 70%),
			radial-gradient(ellipse 22% 40% at 50% 45%, var(--c), transparent 70%),
			radial-gradient(ellipse 28% 55% at 78% 62%, var(--c), transparent 70%),
			linear-gradient(to top, var(--c), transparent 70%);
		background-repeat: repeat-x;
		background-size: 33.3333% 100%;
		filter: blur(2vmin);
		animation:
			loopx linear infinite,
			pulse ease-in-out infinite alternate;
	}
	.mist.m1 {
		--c: oklch(0.5 0.03 195 / 0.35);
		bottom: 8%;
		height: 30%;
		animation-duration: 90s, 9s;
	}
	.mist.m2 {
		--c: oklch(0.55 0.03 195 / 0.38);
		bottom: -2%;
		height: 24%;
		background-position: 45% 0;
		animation-duration: 60s, 7s;
		animation-direction: reverse, alternate;
	}
	.mist.m3 {
		--c: oklch(0.6 0.03 195 / 0.42);
		bottom: -6%;
		height: 18%;
		background-position: 20% 0;
		animation-duration: 38s, 5.5s;
		animation-delay:
			-12s,
			-3s;
	}

	/* ── Snowfall ── */
	.snow .sky {
		inset: 0;
		background: linear-gradient(
			to bottom,
			oklch(0.12 0.04 265) 0%,
			oklch(0.18 0.05 260) 50%,
			oklch(0.28 0.05 255) 100%
		);
	}
	.haze {
		inset: -20% -20% 40% 30%;
		background: radial-gradient(
			ellipse 50% 50% at 70% 30%,
			oklch(0.5 0.05 250 / 0.3),
			transparent 70%
		);
	}
	.hills {
		left: 0;
		bottom: 0;
		width: 100%;
		height: 36%;
	}
	.hills.far {
		fill: oklch(0.32 0.04 255);
	}
	.hills.mid {
		fill: oklch(0.6 0.04 250);
		height: 30%;
	}
	.hills.near {
		fill: oklch(0.78 0.03 245);
		height: 24%;
	}
	.flake {
		top: -4vh;
		width: var(--size);
		height: var(--size);
		animation: fall linear infinite;
		--fall: 110vh;
	}
	.flake::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: radial-gradient(circle, oklch(0.98 0.01 250) 40%, oklch(0.95 0.02 250 / 0) 72%);
		animation: sway var(--sway) ease-in-out var(--sway-delay) infinite alternate;
	}
	.flake.far {
		opacity: 0.55;
	}
	.flake.mid {
		opacity: 0.8;
	}
	.flake.near {
		filter: blur(0.2vmin);
	}

	/* ── Sunset clouds ── */
	.sunset .sky {
		inset: 0;
		background: linear-gradient(
			to bottom,
			oklch(0.2 0.07 300) 0%,
			oklch(0.36 0.11 320) 30%,
			oklch(0.55 0.16 15) 58%,
			oklch(0.7 0.16 45) 78%,
			oklch(0.78 0.14 65) 100%
		);
	}
	.sunglow {
		left: calc(50% - 50vmax);
		top: calc(78% - 50vmax);
		width: 100vmax;
		height: 100vmax;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			oklch(0.88 0.13 75 / 0.6),
			oklch(0.75 0.15 50 / 0.25) 30%,
			transparent 60%
		);
		animation: pulse 6s ease-in-out infinite alternate;
	}
	.sun {
		left: calc(50% - 9vmin);
		top: calc(78% - 9vmin);
		width: 18vmin;
		height: 18vmin;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			oklch(0.98 0.06 95) 0 60%,
			oklch(0.92 0.11 80 / 0.5) 68%,
			transparent 72%
		);
	}
	.sunset .clouds {
		background-image:
			radial-gradient(ellipse 24% 22% at 24% 50%, var(--c), transparent 70%),
			radial-gradient(ellipse 18% 14% at 46% 38%, var(--c), transparent 70%),
			radial-gradient(ellipse 22% 18% at 58% 66%, var(--e), transparent 70%),
			radial-gradient(ellipse 24% 20% at 78% 46%, var(--c), transparent 70%),
			radial-gradient(ellipse 16% 10% at 36% 72%, var(--e), transparent 70%);
		filter: blur(1vmin);
	}
	.clouds.high {
		--c: oklch(0.32 0.09 320 / 0.75);
		--e: oklch(0.55 0.13 10 / 0.6);
		top: 8%;
		height: 36%;
		animation-duration: 170s;
	}
	.clouds.low {
		--c: oklch(0.62 0.15 30 / 0.6);
		--e: oklch(0.8 0.12 60 / 0.55);
		top: 46%;
		height: 26%;
		background-position: 55% 0;
		animation-duration: 115s;
	}
	.bird {
		left: -6%;
		width: 3vmin;
		height: 1.2vmin;
		animation: glide linear infinite;
	}
	.bird svg {
		width: 100%;
		height: 100%;
		fill: oklch(0.15 0.04 320);
		animation: flap ease-in-out infinite alternate;
	}
	.sunset .land {
		height: 16%;
		fill: oklch(0.1 0.04 330);
	}
	@keyframes glide {
		from {
			transform: translate(0, 0);
		}
		to {
			transform: translate(112vw, -6vh);
		}
	}
	@keyframes flap {
		from {
			transform: scaleY(1);
		}
		to {
			transform: scaleY(-0.4);
		}
	}

	/* ── Firefly wood ── */
	.fireflies .sky {
		inset: 0;
		background: linear-gradient(
			to bottom,
			oklch(0.16 0.035 165) 0%,
			oklch(0.12 0.03 160) 55%,
			oklch(0.08 0.02 150) 100%
		);
	}
	.moonlight {
		inset: -30% -10% 40%;
		background: radial-gradient(
			ellipse 50% 50% at 60% 30%,
			oklch(0.4 0.05 170 / 0.4),
			transparent 70%
		);
	}
	.trunks {
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.trunks.back {
		fill: oklch(0.1 0.025 160);
	}
	.trunks.front {
		fill: oklch(0.05 0.015 150);
	}
	.groundmist {
		inset: 55% -10% 0;
		background: linear-gradient(to bottom, transparent, oklch(0.3 0.04 160 / 0.4) 60%);
	}
	.brush {
		left: 0;
		bottom: 0;
		width: 100%;
		height: 18%;
		fill: oklch(0.05 0.015 150);
	}
	.fly {
		width: var(--size);
		height: var(--size);
		translate: -50% -50%;
		animation: wander ease-in-out infinite alternate;
	}
	.fly::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			oklch(0.98 0.12 115) 0 12%,
			oklch(0.88 0.19 125 / 0.6) 22%,
			oklch(0.8 0.18 130 / 0) 70%
		);
		opacity: 0;
		animation: blink var(--blink) ease-in-out var(--blink-delay) infinite;
	}
	@keyframes wander {
		0% {
			transform: translate(0, 0);
		}
		33% {
			transform: translate(var(--x1), var(--y1));
		}
		66% {
			transform: translate(var(--x2), var(--y2));
		}
		100% {
			transform: translate(var(--x3), var(--y3));
		}
	}
	@keyframes blink {
		0%,
		30%,
		100% {
			opacity: 0.05;
		}
		50% {
			opacity: 1;
		}
		70% {
			opacity: 0.3;
		}
	}

	/* ── Arcane void ── */
	.abyss {
		inset: 0;
		background: radial-gradient(
			ellipse 80% 80% at 50% 50%,
			oklch(0.2 0.09 300),
			oklch(0.1 0.05 295) 55%,
			oklch(0.05 0.02 290)
		);
	}
	.swirl {
		left: 50%;
		top: 50%;
		width: 150vmax;
		height: 150vmax;
		translate: -50% -50%;
		mix-blend-mode: screen;
		animation: spin linear infinite;
	}
	.swirl.conic {
		border-radius: 50%;
		background: repeating-conic-gradient(
			from 0deg,
			oklch(0.45 0.18 300 / 0.35) 0deg,
			transparent 18deg,
			oklch(0.4 0.15 280 / 0.25) 36deg,
			transparent 54deg,
			oklch(0.45 0.18 300 / 0.35) 72deg
		);
		mask-image: radial-gradient(circle, black 4%, transparent 45%);
		filter: blur(2vmin);
		animation-duration: 90s;
	}
	.swirl.wide,
	.swirl.thin {
		width: 110vmin;
		height: 110vmin;
		fill: none;
		stroke-linecap: round;
	}
	.swirl.wide {
		stroke: oklch(0.55 0.2 300 / 0.55);
		stroke-width: 4;
		filter: blur(1.6vmin);
		animation-duration: 55s;
	}
	.swirl.thin {
		stroke: oklch(0.75 0.13 230 / 0.5);
		stroke-width: 1.2;
		filter: blur(0.5vmin);
		animation-duration: 75s;
		animation-direction: reverse;
	}
	.swirl.runes {
		width: 90vmin;
		height: 90vmin;
		fill: none;
		stroke: oklch(0.7 0.12 300 / 0.25);
		stroke-width: 0.3;
		mix-blend-mode: normal;
		animation-duration: 140s;
	}
	.runes .dash {
		stroke-width: 1.2;
		stroke-dasharray: 0.6 2.4 3 2.4;
	}
	.core {
		left: 50%;
		top: 50%;
		width: 50vmin;
		height: 50vmin;
		translate: -50% -50%;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			oklch(0.85 0.12 300 / 0.7),
			oklch(0.6 0.2 300 / 0.3) 25%,
			transparent 65%
		);
		animation: breathe 5s ease-in-out infinite alternate;
	}
	.spark {
		left: 50%;
		top: 50%;
		width: 6vmin;
		height: 6vmin;
		translate: -50% -50%;
		border-radius: 50%;
		background: radial-gradient(circle, oklch(0.98 0.04 300), transparent 70%);
		animation: pulse 2.2s ease-in-out infinite alternate;
	}
	.orbit {
		left: 50%;
		top: 50%;
		width: 0;
		height: 0;
		animation: spin linear infinite;
	}
	.orbit span {
		position: absolute;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		transform: translateX(var(--r));
		background: radial-gradient(circle, oklch(0.92 0.08 290), oklch(0.7 0.15 290 / 0) 70%);
		animation: twinkle ease-in-out infinite alternate;
	}
	@keyframes breathe {
		from {
			transform: scale(0.9);
			opacity: 0.7;
		}
		to {
			transform: scale(1.1);
			opacity: 1;
		}
	}

	/* The operating system's Reduce motion wins: the scene rests on its still frame. */
	@media (prefers-reduced-motion: reduce) {
		.scene *,
		.scene *::before,
		.scene *::after {
			animation-play-state: paused !important;
		}
	}
</style>
