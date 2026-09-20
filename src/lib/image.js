/**
 * Redimensiona y comprime una imagen del lado del cliente antes de subirla
 * a Storage. Esto es clave para costos: una foto de celular puede pesar
 * 10-20MB, y para mostrarla como foto de una carta no hace falta esa
 * resolución. Bajándola a maxDimension y compresión JPEG, normalmente
 * termina pesando algunos cientos de KB — mucho más barato tanto para
 * almacenar como para las descargas de quien navega el catálogo (eso es
 * lo que más pega en la cuota gratuita de Firebase Storage).
 */
export function compressImage(file, { maxDimension = 1600, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl)
          if (!blob) {
            reject(new Error('No se pudo procesar la imagen.'))
            return
          }
          resolve(blob)
        },
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('No se pudo leer la imagen. Probá con otra foto.'))
    }

    img.src = objectUrl
  })
}
