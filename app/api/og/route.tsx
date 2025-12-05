// app/api/og/route.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const title =
    searchParams.get('t') ?? 'Pauta oficial provincia de Buenos Aires'
  const subtitle =
    searchParams.get('d') ??
    'Visualización de pauta oficial PBA (2023–2025)'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a, #1d4ed8)',
          color: '#f9fafb',
          padding: '80px 120px',
          boxSizing: 'border-box',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 500,
            opacity: 0.8,
            marginBottom: 12,
          }}
        >
          pauta.pba.ar
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            lineHeight: 1.1,
            maxWidth: '800px',
            marginBottom: 24,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 400,
            opacity: 0.9,
            maxWidth: '800px',
            marginBottom: 40,
          }}
        >
          {subtitle}
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '999px',
              backgroundColor: '#22c55e',
            }}
          />
          <span>Pauta oficial · 2023 · 2024 · 2025</span>
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
    }
  )
}
