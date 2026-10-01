const imageTypes = ['image/jpeg', 'image/png', 'image/webp']
const targetLength = 60000

export async function readServiceImage(file: File): Promise<string> {
  if (!imageTypes.includes(file.type) || file.size > 5000000)
    throw new Error('Choose a JPG, PNG, or WebP image up to 5 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    for (const maxSide of [640, 480, 360, 240]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Image processing is unavailable in this browser.')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.82, 0.68, 0.5]) {
        const image = canvas.toDataURL('image/jpeg', quality)
        if (image.length <= targetLength) return image
      }
    }
    throw new Error('This image is too detailed. Choose a simpler service photo.')
  } finally {
    bitmap.close()
  }
}
