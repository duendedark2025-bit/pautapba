import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pauta oficial provincia de Buenos Aires',
  description: 'Visualización de pauta oficial PBA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
