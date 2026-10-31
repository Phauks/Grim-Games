import { cropRect, type AvatarCrop } from '#lib/core/avatars/crop.ts';
import { AVATAR_PICTURE_SIDE } from '#lib/core/sync/room-pictures.ts';
import { pictureSize, unpackPicture, type PickedPicture } from '#lib/ui/picked-picture.ts';
import { readStored, readStoredText, writeStored, writeStoredText } from '#lib/ui/stored.ts';

/**
 * The player's own avatar picture (Trevor, 2026-10-27: "allow setting users profile/icon in the
 * player settings"): picked from the device, cut to the square chosen on the crop screen and shrunk, and kept on this device
 * only. A room the phone joins gets a copy (core/sync/room-pictures.ts), shown on its seat in
 * place of the initials until the Storyteller takes it away for a game.
 */
const KEY = 'grim-games:player-picture:v1';
/**
 * The whole picture it was cut from, shrunk to ORIGINAL_SIDE, and the crop chosen on it, so
 * tapping the picture opens the crop screen again (Trevor, 2026-10-27: "Allow clicking on picture
 * in player settings to preview and edit crop and placement"). A picture kept before these has
 * neither: its crop screen starts from the picture itself.
 */
const ORIGINAL_KEY = 'grim-games:player-picture-original:v1';
const CROP_KEY = 'grim-games:player-picture-crop:v1';
const ORIGINAL_SIDE = 1024;

/**
 * The picture unpacked once (ui/picked-picture.ts), large enough for both copies kept: the whole
 * at ORIGINAL_SIDE and the chosen square at AVATAR_PICTURE_SIDE.
 */
async function unpackForCrop(file: Blob, crop: AvatarCrop): Promise<PickedPicture> {
	const size = await pictureSize(file).catch(() => undefined);
	if (!size) return unpackPicture(file, Infinity);
	const shorter = Math.min(size.width, size.height);
	const square = (AVATAR_PICTURE_SIDE * crop.zoom * Math.max(size.width, size.height)) / shorter;
	return unpackPicture(file, Math.max(ORIGINAL_SIDE, Math.ceil(square)), size);
}

/** The picture shrunk to fit ORIGINAL_SIDE, as a JPEG data URL, and how much it was shrunk. */
function shrunkDataUrl(picture: PickedPicture): { url: string; scale: number } {
	const shrink = Math.min(1, ORIGINAL_SIDE / Math.max(picture.width, picture.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(picture.width * shrink));
	canvas.height = Math.max(1, Math.round(picture.height * shrink));
	canvas.getContext('2d')?.drawImage(picture.image, 0, 0, canvas.width, canvas.height);
	// Against the picture's own size, as the crop is.
	return { url: canvas.toDataURL('image/jpeg', 0.85), scale: shrink * picture.scale };
}

function readCrop(): AvatarCrop | undefined {
	const raw = readStored<Partial<AvatarCrop>>(CROP_KEY);
	const ok = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
	return raw && ok(raw.zoom) && ok(raw.x) && ok(raw.y) ? (raw as AvatarCrop) : undefined;
}

/** The picture's chosen square (core/avatars/crop.ts), shrunk to AVATAR_PICTURE_SIDE, as a JPEG. */
function squareDataUrl(picture: PickedPicture, crop: AvatarCrop): string {
	const { scale } = picture;
	const rect = cropRect({ zoom: crop.zoom, x: crop.x * scale, y: crop.y * scale }, picture);
	const side = Math.max(1, Math.round(Math.min(AVATAR_PICTURE_SIDE, rect.side)));
	const canvas = document.createElement('canvas');
	canvas.width = side;
	canvas.height = side;
	const ctx = canvas.getContext('2d');
	ctx?.drawImage(picture.image, rect.x, rect.y, rect.side, rect.side, 0, 0, side, side);
	return canvas.toDataURL('image/jpeg', 0.85);
}

async function dataUrlBlob(url: string): Promise<Blob> {
	const [head, data] = url.split(',');
	const type = head.match(/^data:([^;]+)/)?.[1] ?? 'image/jpeg';
	return new Blob([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], { type });
}

class AvatarPicture {
	#url = $state<string | undefined>(readStoredText(KEY));
	#blob: { url: string; blob: Promise<Blob> } | undefined;

	/** The picture as a data URL, to draw; undefined while the player uses their initials. */
	get url(): string | undefined {
		return this.#url;
	}

	/** The picture's bytes, to upload to a room. */
	blob(): Promise<Blob> | undefined {
		const url = this.#url;
		if (!url) return undefined;
		if (this.#blob?.url !== url) this.#blob = { url, blob: dataUrlBlob(url) };
		return this.#blob.blob;
	}

	/**
	 * The whole picture to crop again, and the crop last chosen on it; the kept picture itself
	 * for one saved before the whole picture was kept.
	 */
	async editable(): Promise<{ file: Blob; crop?: AvatarCrop } | undefined> {
		const original = readStoredText(ORIGINAL_KEY);
		const url = original ?? this.#url;
		if (!url) return undefined;
		return { file: await dataUrlBlob(url), crop: original ? readCrop() : undefined };
	}

	/** Keeps the chosen square of a picture from the device; false when it can't be read or kept. */
	async choose(file: Blob, crop: AvatarCrop): Promise<boolean> {
		try {
			const picture = await unpackForCrop(file, crop);
			let url: string;
			let original: { url: string; scale: number };
			try {
				url = squareDataUrl(picture, crop);
				original = shrunkDataUrl(picture);
			} finally {
				picture.close();
			}
			if (!writeStoredText(KEY, url)) return false;
			this.#url = url;
			// The whole picture only helps a later edit: a full storage still keeps the avatar.
			const { scale } = original;
			const kept = { zoom: crop.zoom, x: crop.x * scale, y: crop.y * scale };
			if (writeStoredText(ORIGINAL_KEY, original.url)) writeStored(CROP_KEY, kept);
			else writeStored(CROP_KEY, undefined);
			return true;
		} catch {
			return false;
		}
	}

	clear(): void {
		writeStoredText(KEY, undefined);
		writeStoredText(ORIGINAL_KEY, undefined);
		writeStored(CROP_KEY, undefined);
		this.#url = undefined;
	}
}

export const avatarPicture = new AvatarPicture();
