/**
 * Compresses an image file on the client using HTML5 Canvas and returns a compact Data URL.
 * Produces crisp WebP/JPEG images under ~40-60 KB suitable for direct database storage.
 */
export async function fileToDataUrl(file: File, maxDim = 500, quality = 0.75): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const rawSrc = e.target?.result;
			if (typeof rawSrc !== 'string') return reject(new Error('CANNOT_READ_FILE'));

			const img = new Image();
			img.onload = () => {
				try {
					const canvas = document.createElement('canvas');
					let { width, height } = img;
					if (width > maxDim || height > maxDim) {
						if (width > height) {
							height = Math.round((height * maxDim) / width);
							width = maxDim;
						} else {
							width = Math.round((width * maxDim) / height);
							height = maxDim;
						}
					}
					canvas.width = width;
					canvas.height = height;
					const ctx = canvas.getContext('2d');
					if (!ctx) return resolve(rawSrc);

					ctx.imageSmoothingEnabled = true;
					ctx.imageSmoothingQuality = 'high';
					ctx.drawImage(img, 0, 0, width, height);

					// Try webp first, fall back to jpeg
					try {
						const webp = canvas.toDataURL('image/webp', quality);
						if (webp.startsWith('data:image/webp')) return resolve(webp);
					} catch {}
					resolve(canvas.toDataURL('image/jpeg', quality));
				} catch {
					resolve(rawSrc);
				}
			};
			img.onerror = () => reject(new Error('CANNOT_DECODE_IMAGE'));
			img.src = rawSrc;
		};
		reader.onerror = () => reject(new Error('CANNOT_READ_FILE'));
		reader.readAsDataURL(file);
	});
}
