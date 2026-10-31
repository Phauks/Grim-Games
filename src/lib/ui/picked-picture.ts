/**
 * A picture picked from the device, unpacked no larger than it is kept (memory sweep,
 * 2026-10-31). Unpacking a phone photo whole takes four bytes a pixel: about 96 MB for 24
 * megapixels, for a background kept at 1920 pixels or a profile picture at 1024. Where the
 * browser has `ImageDecoder` (Chrome, Edge, Firefox; not Safari), a JPEG is unpacked straight
 * at a fraction of its size instead; elsewhere it is unpacked whole, as before.
 */
import type { PictureSize } from '#lib/core/avatars/crop.ts';

export interface PickedPicture {
	/** To draw on a canvas. */
	image: CanvasImageSource;
	width: number;
	height: number;
	/** `width` over the picture's own width: 1 when it was unpacked whole. */
	scale: number;
	/** Frees the unpacked pixels. */
	close(): void;
}

/** The picture's own size, turned upright as its camera marked it, read without unpacking it. */
export function pictureSize(file: Blob): Promise<PictureSize> {
	const url = URL.createObjectURL(file);
	const img = new Image();
	return new Promise<PictureSize>((resolve, reject) => {
		img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
		img.onerror = () => reject(new Error('Image could not be read'));
		img.src = url;
	}).finally(() => URL.revokeObjectURL(url));
}

/**
 * The picture unpacked with at least `side` pixels on its longer side (or whole, when it is no
 * larger), to be shrunk to `side` on a canvas. `size` is its own size, when already known.
 */
export async function unpackPicture(
	file: Blob,
	side: number,
	size?: PictureSize
): Promise<PickedPicture> {
	const small = await unpackSmall(file, side, size).catch(() => undefined);
	if (small) return small;
	const bitmap = await createImageBitmap(file);
	return {
		image: bitmap,
		width: bitmap.width,
		height: bitmap.height,
		scale: 1,
		close: () => bitmap.close()
	};
}

/** Undefined where the browser can't unpack it small, or what came back isn't right. */
async function unpackSmall(
	file: Blob,
	side: number,
	known?: PictureSize
): Promise<PickedPicture | undefined> {
	// A frame that can't say how the camera turned it might come back on its side.
	if (typeof ImageDecoder === 'undefined' || !('rotation' in VideoFrame.prototype)) return;
	if (!file.type || !(await ImageDecoder.isTypeSupported(file.type))) return;
	const size = known ?? (await pictureSize(file));
	// A JPEG unpacks at eighths of its size: the smallest that still gives `side` pixels.
	const longest = Math.max(size.width, size.height);
	const eighths = Math.ceil((8 * side) / longest);
	if (eighths >= 8) return;
	// Square, as the frame may be stored on its side: either way its longer side fits.
	const desired = Math.ceil((longest * eighths) / 8);
	const decoder = new ImageDecoder({
		data: file.stream(),
		type: file.type,
		desiredWidth: desired,
		desiredHeight: desired
	});
	let frame: VideoFrame;
	try {
		({ image: frame } = await decoder.decode());
	} finally {
		decoder.close();
	}
	const width = frame.displayWidth;
	const height = frame.displayHeight;
	// Upright as the picture's own size says, and large enough (a browser that unpacks only at
	// halves comes back smaller); otherwise unpacked whole.
	const upright = Math.abs(width / height - size.width / size.height) < 0.02;
	if (!upright || Math.max(width, height) < side) {
		frame.close();
		return;
	}
	// Drawn as it is: a frame draws upright, and copying it to a canvas would double it.
	return {
		image: frame,
		width,
		height,
		scale: width / size.width,
		close: () => frame.close()
	};
}
