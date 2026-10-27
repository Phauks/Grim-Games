/**
 * A fountain code (an LT code, Luby 2002) for animated QR codes (Trevor, 2026-10-27: "make this
 * faster"). The bytes are cut into K blocks. Piece 1 to K are the blocks themselves, so a phone
 * that reads every frame of the first loop is done after K; every later piece is several blocks
 * XORed together, chosen from its number, and fills in whichever blocks the phone missed. Any K
 * or a few more pieces, in any order, rebuild the bytes: a missed frame no longer means waiting
 * a whole loop for it to come round again.
 *
 * Background: Divan, "Fountain codes and animated QR" (https://divan.dev/posts/fountaincodes/);
 * MacKay, "Fountain codes" (IEE Proc. Communications 152(6), 2005) for the robust soliton
 * distribution used for the pieces' degrees.
 */

/** A deterministic random number generator (mulberry32), so both phones pick the same blocks. */
function random(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Cumulative robust soliton distribution over degrees 1..k (MacKay 2005, §3). */
function robustSoliton(k: number, c = 0.1, delta = 0.5): number[] {
	const s = c * Math.log(k / delta) * Math.sqrt(k);
	const pivot = Math.max(1, Math.min(k, Math.floor(k / s)));
	const weights = Array.from({ length: k }, (_, i) => {
		const d = i + 1;
		const rho = d === 1 ? 1 / k : 1 / (d * (d - 1));
		const tau = d < pivot ? s / (k * d) : d === pivot ? (s * Math.log(s / delta)) / k : 0;
		return rho + Math.max(0, tau);
	});
	const total = weights.reduce((a, b) => a + b, 0);
	let sum = 0;
	return weights.map((w) => (sum += w / total));
}

const distributions = new Map<number, number[]>();

/**
 * The blocks piece `seq` (from 1) is made of, out of `k`. Pieces 1..k are one block each;
 * later ones are drawn from the piece number and the text's id.
 */
export function pieceBlocks(seq: number, k: number, id: number): number[] {
	if (seq <= k) return [seq - 1];
	let cdf = distributions.get(k);
	if (!cdf) distributions.set(k, (cdf = robustSoliton(k)));
	const next = random(Math.imul(seq, 0x9e3779b1) ^ id);
	const roll = next();
	const degree = Math.max(1, Math.min(k, cdf.findIndex((p) => roll <= p) + 1));
	const blocks = new Set<number>();
	while (blocks.size < degree) blocks.add(Math.floor(next() * k));
	return [...blocks].sort((a, b) => a - b);
}

/** The block count for `length` bytes in blocks of `size`. */
export function blockCount(length: number, size: number): number {
	return Math.max(1, Math.ceil(length / size));
}

/** Piece `seq` of `bytes`, cut into blocks of `size` (the last padded with zeros). */
export function encodePiece(bytes: Uint8Array, size: number, seq: number, id: number): Uint8Array {
	const k = blockCount(bytes.length, size);
	const out = new Uint8Array(size);
	for (const block of pieceBlocks(seq, k, id)) {
		const part = bytes.subarray(block * size, (block + 1) * size);
		for (let i = 0; i < part.length; i++) out[i] ^= part[i];
	}
	return out;
}

interface Piece {
	blocks: Set<number>;
	data: Uint8Array;
}

/** Rebuilds bytes from pieces in any order, as a phone reads them (a peeling decoder). */
export class FountainDecoder {
	readonly k: number;
	readonly #size: number;
	readonly #length: number;
	readonly #id: number;
	readonly #blocks: (Uint8Array | undefined)[];
	/** Pieces still made of two or more unknown blocks. */
	#waiting: Piece[] = [];
	readonly #seen = new Set<number>();
	#known = 0;

	constructor(length: number, size: number, id: number) {
		this.k = blockCount(length, size);
		this.#size = size;
		this.#length = length;
		this.#id = id;
		this.#blocks = Array.from({ length: this.k }, () => undefined);
	}

	/** How many of the K blocks are known. */
	get known(): number {
		return this.#known;
	}

	/** Which blocks are known, for the reading phone's progress. */
	get have(): boolean[] {
		return this.#blocks.map((b) => b !== undefined);
	}

	get done(): boolean {
		return this.#known === this.k;
	}

	/** Adds piece `seq`; a piece already read, or of the wrong size, changes nothing. */
	add(seq: number, data: Uint8Array): void {
		if (this.done || data.length !== this.#size || this.#seen.has(seq)) return;
		this.#seen.add(seq);
		const piece: Piece = {
			blocks: new Set(pieceBlocks(seq, this.k, this.#id)),
			data: data.slice()
		};
		this.#reduce(piece);
		if (piece.blocks.size === 1) this.#learn(piece);
		else if (piece.blocks.size > 1) this.#waiting.push(piece);
	}

	/** Takes the blocks already known out of a piece. */
	#reduce(piece: Piece): void {
		for (const block of [...piece.blocks]) {
			const known = this.#blocks[block];
			if (!known) continue;
			for (let i = 0; i < this.#size; i++) piece.data[i] ^= known[i];
			piece.blocks.delete(block);
		}
	}

	#learn(first: Piece): void {
		const queue = [first];
		while (queue.length) {
			const piece = queue.pop()!;
			const [block] = piece.blocks;
			if (block === undefined || this.#blocks[block]) continue;
			this.#blocks[block] = piece.data;
			this.#known++;
			const still: Piece[] = [];
			for (const other of this.#waiting) {
				this.#reduce(other);
				if (other.blocks.size === 1) queue.push(other);
				else if (other.blocks.size > 1) still.push(other);
			}
			this.#waiting = still;
		}
	}

	/** The bytes, once every block is known. */
	bytes(): Uint8Array | undefined {
		if (!this.done) return undefined;
		const out = new Uint8Array(this.k * this.#size);
		this.#blocks.forEach((block, i) => out.set(block!, i * this.#size));
		return out.slice(0, this.#length);
	}
}
