/**
 * What Take a Photo accepts. A phone opens its camera straight away only when the input asks
 * for images alone, so PDFs are offered where a mouse is used (Trevor, 2026-11-05: a PDF did
 * nothing); on a phone a PDF goes through Upload File instead.
 */
export const PHOTO_ACCEPT =
	typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
		? 'image/*'
		: 'image/*,application/pdf,.pdf';
