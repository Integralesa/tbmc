/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14161C',        // fondo casi negro, sala de subastas de noche
        panel: '#1C1F28',      // paneles/tarjetas
        panelLine: '#2B2F3B',  // bordes sutiles
        parchment: '#EDE7DA',  // texto principal, tono catálogo
        muted: '#8A8FA3',      // texto secundario
        brass: '#C79A4B',      // acento — martillo de subasta, marco dorado
        brassHigh: '#E0B563',
        bidGreen: '#4E9A6B',   // confirmaciones / puja activa
        bidRed: '#C1544B',     // urgencia / cierre próximo
      },
      fontFamily: {
        serif: ['Newsreader', 'serif'],
        sans: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
