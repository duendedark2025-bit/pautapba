// app/api/og/route.ts
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const t = searchParams.get('t') || 'Pauta oficial provincia de Buenos Aires'
  const d = searchParams.get('d') || 'Visualización de pauta oficial PBA (2023–2025)'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg,#0b1220,#0f172a)',
          color: 'white',
          padding: 48,
          fontFamily: 'system-ui, Segoe UI, Roboto, Arial, sans-serif',
        }}
      >
        <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.1 }}>{t}</div>
        <div style={{ fontSize: 28, opacity: 0.9 }}>{d}</div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 22, opacity: 0.8 }}>pautapba.vercel.app</div>
          <div
            style={{
              background: '#ff1744',
              padding: '10px 20px',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 22,
            }}
          >
            2023 · 2024 · 2025
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
