'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react';
import Head from 'next/head';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList
} from 'recharts';
import {
  Search, Loader2, Download, X as XIcon, Eye,
  Sun, Moon, ChevronLeft, ChevronRight, Pause, Play,
  CopyIcon, ChevronDown, ChevronUp, Link as LinkIcon,
  Minimize2, Maximize2, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// =========================
// Tipos y utilidades
// =========================
type Registro = {
  Proveedor: string;
  Medio: string;
  Mes: string;
  Resolución: string;
  Importe: number;
  __Año?: number;
  __Fuente?: string;
};

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2
});

const compactFormatter = new Intl.NumberFormat('es-AR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const normalize = (s: string) =>
  (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();


// Canonicaliza nombres de meses a español completo en minúsculas (ej: 'nov'/'nov.'/'noviembre' -> 'noviembre')
function canonMonth(raw: string): string {
  const n = normalize(String(raw)).replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  // atajos y variantes comunes (es/en/abrev)
  if (n.startsWith('ene') || n.startsWith('jan')) return 'enero';
  if (n.startsWith('feb')) return 'febrero';
  if (n.startsWith('mar')) return 'marzo';
  if (n.startsWith('abr') || n.startsWith('apr')) return 'abril';
  if (n.startsWith('may')) return 'mayo';
  if (n.startsWith('jun')) return 'junio';
  if (n.startsWith('jul')) return 'julio';
  if (n.startsWith('ago') || n.startsWith('aug')) return 'agosto';
  if (n.startsWith('sep') || n.startsWith('set')) return 'septiembre';
  if (n.startsWith('oct')) return 'octubre';
  if (n.startsWith('nov')) return 'noviembre';
  if (n.startsWith('dic') || n.startsWith('dec')) return 'diciembre';
  // fallback: si coincide con alguno de los oficiales ya normalizados
  const candidates = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const hit = candidates.find(m => n === m);
  return hit || n;
}


// === Helpers de meses (orden universal Dic→Ene) ===
const MONTHS_DESC = ['diciembre','noviembre','octubre','septiembre','agosto','julio','junio','mayo','abril','marzo','febrero','enero'];
function monthRank(m: string): number { return MONTHS_DESC.indexOf(canonMonth(m)); }
function labelMonth(m: string): string { const c = canonMonth(m); return c.charAt(0).toUpperCase() + c.slice(1); }

function yearFromFilename(name: string): number {
  const m = name.match(/(20\d{2})/);
  return m ? parseInt(m[1], 10) : 0;
}

// URL PDF robusta
function pdfUrl(r: Registro): string | null {
  if (!r.__Año || !r.Mes || !r.Resolución) return null;
  const mes = labelMonth(r.Mes);
  const folder = `Pauta - Pauta provincia de Buenos Aires ${r.__Año}`;
  let base = r.Resolución.trim();
  if (!base.toLowerCase().startsWith('resolución')) base = `Resolución ${base}`;
  if (!base.toLowerCase().endsWith('.pdf')) base = `${base}.pdf`;
  return `/${encodeURIComponent(folder)}/${encodeURIComponent(mes)}/${encodeURIComponent(base)}`;
}

function firstLetterOf(name: string): string {
  if (!name) return '#';
  const ch = name.trim().charAt(0).toUpperCase();
  return ch >= 'A' && ch <= 'Z' ? ch : '#';
}

// Hook para saber si estamos en pantallas pequeñas/medianas
function useBreakpoint() {
  const [bp, setBp] = useState<'sm' | 'md' | 'lg' | 'xl'>('sm');
  useEffect(() => {
    const mds = [
      window.matchMedia('(min-width: 1280px)'),
      window.matchMedia('(min-width: 1024px)'),
      window.matchMedia('(min-width: 768px)')
    ];
    const update = () => {
      if (mds[0].matches) setBp('xl');
      else if (mds[1].matches) setBp('lg');
      else if (mds[2].matches) setBp('md');
      else setBp('sm');
    };
    update();
    mds.forEach(m => m.addEventListener('change', update));
    return () => mds.forEach(m => m.removeEventListener('change', update));
  }, []);
  return bp;
}

// =========================
// Encriptación para links compartibles (AES-GCM con PBKDF2)
// =========================
const SHARE_PASSPHRASE = 'pba-pauta-compartir-2025';
const SHARE_SALT = new TextEncoder().encode('pba-salt-v1');
async function deriveKey() {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(SHARE_PASSPHRASE),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SHARE_SALT, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
function toBase64Url(bytes: Uint8Array) {
  let str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromBase64Url(s: string) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
async function encryptMedium(medio: string) {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify({ medio, ts: Date.now() }));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0);
  packed.set(ct, iv.length);
  return toBase64Url(packed);
}
async function decryptMedium(token: string): Promise<string | null> {
  try {
    const key = await deriveKey();
    const packed = fromBase64Url(token);
    const iv = packed.slice(0, 12);
    const ct = packed.slice(12);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    const obj = JSON.parse(new TextDecoder().decode(new Uint8Array(pt)));
    return typeof obj?.medio === 'string' ? obj.medio : null;
  } catch {
    return null;
  }
}

// =========================
type Slide = { titulo: string; bullets: string[] };

const INTRO_SLIDES: Slide[] = [
  {
    titulo: '¿Sabías que si el Gobernador usa el 100% de lo que gasta en pauta puede mejorar? 🛡️ Seguridad',
    bullets: [
      '💰 $79.284.916.379 ARS (u$s 83.457.806) – 100%',
      '🚓 Comprar 15.800 patrulleros ($5.000.000 c/u).',
      '📹 Instalar 158.000 cámaras de seguridad ($500.000 c/u).',
      '👮 Pagar el aumento salarial del 30% para más de 90.000 policías bonaerenses durante un año.',
      '🛡️ Comprar 80.000 chalecos antibalas ($300.000 c/u).',
      '🚨 Renovar sistemas de comunicación digital y GPS para toda la fuerza.',
    ],
  },
  {
    titulo: '¿Sabías que si el Gobernador usa el 100% de lo que gasta en pauta puede mejorar? 🎓 Educación',
    bullets: [
      '💰 $79.284.916.379 ARS (u$s 83.457.806) – 100%',
      '🏫 Construir 1.585 escuelas nuevas ($50.000.000 c/u).',
      '💻 Entregar 528.000 notebooks ($150.000 c/u).',
      '📚 Dotar de 10 millones de libros de texto ($8.000 c/u).',
      '👩‍🏫 Financiar un aumento del 25% en salarios docentes por un año.',
      '🏫 Equipar 3.000 escuelas con laboratorios de ciencias y tecnología ($5.000.000 c/u).',
    ],
  },
  {
    titulo: '¿Sabías que si el Gobernador usa el 100% de lo que gasta en pauta puede mejorar? 🏥 Salud',
    bullets: [
      '💰 $79.284.916.379 ARS (u$s 83.457.806) – 100%',
      '🏥 Construir o equipar 395 hospitales ($200.000.000 c/u).',
      '🚑 Comprar 5.285 ambulancias ($15.000.000 c/u).',
      '💉 Financiar la vacunación completa contra la gripe para toda la población bonaerense.',
      '🩺 Adquirir 10.000 respiradores artificiales ($4.000.000 c/u).',
      '⚕️ Aumentar en 20% los salarios de médicos y enfermeros durante un año.',
      '🧪 Comprar 100.000 equipos de diagnóstico por imágenes y laboratorio ($700.000 c/u).',
      'NOTA: IOMA (a cargo de Kicillof) le debe al Garrahan $ 4.135.942.984.',
    ],
  },
  {
    titulo: '¿Sabías que si el Gobernador usa el 100% de lo que gasta en pauta puede mejorar? 🚧 Infraestructura',
    bullets: [
      '💰 $79.284.916.379 ARS (u$s 83.457.806) – 100%',
      '🚰 Ampliar redes de agua potable y cloacas a más de 1 millón de hogares.',
      '🛣️ Pavimentar 7.900 cuadras urbanas ($10.000.000 c/u).',
      '🏗️ Construir 250 centros comunitarios ($300.000.000 c/u).',
      '🚍 Renovar la flota de 2.000 colectivos urbanos ($30.000.000 c/u).',
      '💡 Instalar 4 millones de luminarias LED ($20.000 c/u).',
    ],
  },
  {
    titulo: '¿Sabías que si el Gobernador usa el 100% de lo que gasta en pauta puede mejorar? 🤝 Desarrollo Social',
    bullets: [
      '💰 $79.284.916.379 ARS (u$s 83.457.806) – 100%',
      '🍲 Financiar 26.000 comedores comunitarios durante un año ($3.000.000 c/u).',
      '👵 Otorgar 79.000 pensiones sociales de $1.000.000 c/u.',
      '🎓 Brindar 793.000 becas de capacitación laboral de $100.000 c/u.',
      '🏘️ Construir 40.000 viviendas sociales ($2.000.000 c/u).',
      '🧒 Financiar jardines maternales en 500 municipios ($100.000.000 c/u).',
    ],
  },
];

// =========================
// Modal Slider
// =========================
function IntroModal({
  open,
  onClose,
  dark,
}: {
  open: boolean;
  onClose: () => void;
  dark: boolean;
}) {
  const bp = useBreakpoint();
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0); // 0..100
  const total = INTRO_SLIDES.length;

  const hoverRef = useRef(false);
  const lastTs = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  const DURATION = bp === 'sm' ? 5000 : 6000; // ms

  useEffect(() => {
    if (!open) return;

    const step = (ts: number) => {
      if (!playing || hoverRef.current) {
        lastTs.current = ts;
      } else {
        if (lastTs.current == null) lastTs.current = ts;
        const dt = ts - lastTs.current;
        lastTs.current = ts;
        setProgress((p) => {
          const inc = (dt / DURATION) * 100;
          const next = p + inc;
          if (next >= 100) {
            setIdx((i) => (i + 1) % total);
            return 0;
          }
          return next;
        });
      }
      rafId.current = requestAnimationFrame(step);
    };

    rafId.current = requestAnimationFrame(step);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = null;
      lastTs.current = null;
    };
  }, [open, playing, total, DURATION]);

  const go = (next: number) => {
    setIdx((next + total) % total);
    setProgress(0);
    lastTs.current = null;
  };

  const togglePlay = () => {
    setPlaying((p) => !p);
    lastTs.current = null;
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black"
            onClick={onClose}
          />

          {/* Contenedor full-screen centrado */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
            onMouseEnter={() => (hoverRef.current = true)}
            onMouseLeave={() => (hoverRef.current = false)}
          >
            <div className={`relative card w-[min(960px,96vw)] ${dark ? 'bg-neutral-900 border border-neutral-700 text-neutral-100' : 'bg-white border border-neutral-200 text-neutral-900'} p-4 sm:p-5 overflow-hidden`}
            >
              {/* Cerrar */}
              <button
                onClick={onClose}
                className={`absolute right-2 sm:right-3 top-2 sm:top-3 rounded-md px-2 py-1 text-sm ${dark ? 'bg-neutral-800 hover:bg-neutral-700' : 'bg-neutral-100 hover:bg-neutral-200'}`}
                aria-label="Cerrar"
                title="Cerrar"
              >
                <XIcon className="h-4 w-4" />
              </button>

              {/* Barra de progreso */}
              <div className={`absolute left-0 top-0 h-1 w-full ${dark ? 'bg-neutral-800' : 'bg-neutral-200'}`}>
                <div
                  className="h-full transition-[width] duration-100 linear"
                  style={{ width: `${progress}%`, background: '#ff1744' }}
                />
              </div>

              {/* Slides */}
              <div className="min-h-[260px] sm:min-h-[240px] pt-2">
                <motion.h3
                  key={`title-${idx}`}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-base sm:text-lg md:text-xl font-bold mb-3 leading-snug"
                >
                  {INTRO_SLIDES[idx].titulo}
                </motion.h3>
                <motion.ul
                  key={`list-${idx}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.05 }}
                  className="space-y-2 text-sm sm:text-base"
                >
                  {INTRO_SLIDES[idx].bullets.map((b, i) => (
                    <li key={i} className="leading-relaxed">• {b}</li>
                  ))}
                </motion.ul>
              </div>

              {/* Controles */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => go(idx - 1)}
                    className="btn btn-soft inline-flex items-center gap-1 text-sm"
                    title="Anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>
                  <button
                    onClick={() => go(idx + 1)}
                    className="btn btn-soft inline-flex items-center gap-1 text-sm"
                    title="Siguiente"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="btn btn-soft inline-flex items-center gap-2 text-sm"
                    title={playing ? 'Pausar' : 'Reproducir'}
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {playing ? 'Pausar' : 'Play'}
                  </button>
                  {/* Dots */}
                  <div className="flex items-center gap-2">
                    {Array.from({ length:  total }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => go(i)}
                        aria-label={`Ir al slide ${i + 1}`}
                        className={`h-2.5 w-2.5 rounded-full ${i === idx ? 'bg-[#ff1744]' : (dark ? 'bg-neutral-700' : 'bg-neutral-300')}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// =========================
function ValueLabel({
  x, y, value, dark, compact = false,
}: {
  x?: number; y?: number; value?: number | string; dark: boolean; compact?: boolean;
}) {
  if (typeof x !== 'number' || typeof y !== 'number' || value == null) return null;
  const num = Number(value);
  const txt = compact ? compactFormatter.format(num) : currencyFormatter.format(num);
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={12}
      fill={dark ? '#9ca3af' : '#6b7280'}
    >
      <tspan dy="-6">{txt}</tspan>
    </text>
  );
}


// =========================
// Splash de inicio (#KICILLOFHDRMP) - CRISP (sin blur, sin escala)
// =========================
function SplashScreen({ dark, onDone }: { dark: boolean; onDone: () => void }) {
  const text = "#PAUTAPBA";
  const holdAfterMs = 2200;

  React.useEffect(() => {
    const t = setTimeout(onDone, holdAfterMs + text.length * 60);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className={`fixed inset-0 z-[9999] flex items-center justify-center ${dark ? 'bg-black' : 'bg-white'}`}
        style={{ overscrollBehavior: 'none' }}
      >
        <style jsx>{`
          .crisp-text {
            line-height: 1;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: geometricPrecision;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-weight: 900;
            letter-spacing: 0.01em;
          }
          .stroke {
            -webkit-text-stroke: 1px ${'${dark ? "#000" : "#fff"}'};
          }
          @keyframes letterIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        `}</style>
        <div
          className={`crisp-text ${dark ? 'text-white' : 'text-black'}`}
          style={{
            fontSize: 'clamp(52px, 12vw, 120px)',
            textAlign: 'center',
            transform: 'none',
            filter: 'none'
          }}
        >
          {Array.from(text).map((ch, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                opacity: 0,
                animation: 'letterIn 180ms ease-out forwards',
                animationDelay: `${i * 60}ms`
              }}
            >
              {ch}
            </span>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// =========================
// Página principal
// =========================
export default function Page() {
  
  // Splash de inicio CRISP
  const [splashVisible, setSplashVisible] = useState(true);
  useEffect(() => {
    // se oculta cuando el componente llama onDone
  }, []);
const [data, setData] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);

  // Tema: noche por defecto
  const [dark, setDark] = useState(true);

  // Modal de inicio
  const [showIntro, setShowIntro] = useState(true);

  // Búsqueda
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // Medio seleccionado (gráfico en detalle)
  const [selectedMedium, setSelectedMedium] = useState<string | null>(null);

  // Filtro por año global
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');

  // Acordeones (botones azules)
  const [topOpen, setTopOpen] = useState(false);
  const [azOpen, setAzOpen] = useState(false);

  // Índice A–Z horizontal
  const letters = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
  const [azLetter, setAzLetter] = useState<'ALL' | '#' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'>('ALL');

  // Paginación
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Export
  const [exportYear, setExportYear] = useState<'all' | number>('all');

  // Compartir
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copyOk, setCopyOk] = useState(false);

  // Gráfico principal: modos
  type ChartMode = 'yearTotals' | 'monthsOfYear';
  const [chartMode, setChartMode] = useState<ChartMode>('yearTotals');
  const [chartYear, setChartYear] = useState<number | null>(null);

  // Detalle fullscreen real (API Fullscreen)
  const [detailFullscreen, setDetailFullscreen] = useState(false);

  // Gráfico en Detalle (por medio) - modos
  type DetailChartMode = 'years' | 'months';
  const [detailChartMode, setDetailChartMode] = useState<DetailChartMode>('years'); // predeterminado "Todos los años"
  const [detailYear, setDetailYear] = useState<number | null>(null);

  const detailRef = useRef<HTMLDivElement>(null);
  // --- Búsqueda: scroll suave hacia resultados / proveedor ---
  const scrollToResults = React.useCallback(() => {
    const target = detailRef?.current || document.querySelector('#detalle, [data-section="detalle"]') as HTMLElement;
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToFirstMatch = React.useCallback(() => {
    try {
      const first = document.querySelector('[data-card="detalle-item"]') as HTMLElement;
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {}
  }, []);

  const rootRef = useRef<HTMLDivElement>(null); // contenedor para capturas
  const bp = useBreakpoint();

  // ===== NUEVO: sincronizar estado con Fullscreen API
  useEffect(() => {
    const onFsChange = () => {
      const isFs = !!document.fullscreenElement && document.fullscreenElement === detailRef.current;
      setDetailFullscreen(isFs);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Tema al iniciar
  useEffect(() => {
    const pref = localStorage.getItem('pba_theme');
    if (pref === 'light') {
      setDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      setDark(true);
      document.documentElement.classList.add('dark');
      localStorage.setItem('pba_theme', 'dark');
    }
  }, []);

  function toggleTheme() {
    setDark(prev => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('pba_theme', next ? 'dark' : 'light');
      return next;
    });
  }

  // Cargar JSON + manejar link compartido
  useEffect(() => {
    let canceled = false;

    const params = new URLSearchParams(window.location.search);
    const token = params.get('s');
    const medioPlain = params.get('medio');

    async function loadDefaults() {
      setLoading(true);
      const defaults = [
        { url: '/data/pauta_bsas_2023.json', name: 'pauta_bsas_2023.json' },
        { url: '/data/pauta_bsas_2024.json', name: 'pauta_bsas_2024.json' },
        { url: '/data/pauta_bsas_2025.json', name: 'pauta_bsas_2025.json' }
      ];
      const chunks: Registro[] = [];
      for (const f of defaults) {
        try {
          const res = await fetch(f.url, { cache: 'no-store' });
          if (!res.ok) continue;
          const json = await res.json();
          const year = yearFromFilename(f.name);
          for (const r of json as Registro[]) {
            chunks.push({ ...r, __Año: r.__Año ?? year, __Fuente: f.name });
          }
        } catch {}
      }

      if (!canceled) {
        setData(chunks);
        setLoading(false);

        (async () => {
          let medioFromLink: string | null = null;
          if (token) medioFromLink = await decryptMedium(token);
          if (!medioFromLink && medioPlain) medioFromLink = medioPlain;

          if (medioFromLink && medioFromLink.trim()) {
            setShowIntro(false);
            setQueryInput(medioFromLink);
            setQuery(medioFromLink);
            setSelectedMedium(medioFromLink);
            setPage(1);
            // NO activamos fullscreen en ingresos por link compartido.
            const enc = token || await encryptMedium(medioFromLink);
            const url = new URL(window.location.href);
            url.searchParams.set('s', enc);
            history.replaceState({}, '', url.toString());
            setShareUrl(url.toString());
            setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
          } else if (token) {
            const url = new URL(window.location.href);
            url.searchParams.delete('s');
            history.replaceState({}, '', url.toString());
          }
        })();
      }
    }

    if (token || medioPlain) setShowIntro(false);

    loadDefaults();
    return () => { canceled = true; };
  }, []);

  // Años disponibles
  const availableYears = useMemo(() => {
    const s = new Set<number>();
    data.forEach(d => d.__Año && s.add(d.__Año));
    return Array.from(s).sort((a, b) => a - b);
  }, [data]);

  // ======= Agregaciones (gráfico principal) =======
  const totalsByYear = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of data) {
      const y = r.__Año || 0;
      m.set(y, (m.get(y) || 0) + (Number(r.Importe) || 0));
    }
    return Array.from(m.entries())
      .filter(([y]) => y > 0)
      .sort((a, b) => a[0] - b[0])
      .map(([y, t]) => ({ year: y, total: t }));
  }, [data]);

  const grandTotal = useMemo(
    () => totalsByYear.reduce((acc, x) => acc + x.total, 0),
    [totalsByYear]
  );

  const MONTHS_ORDER = [
    'enero','febrero','marzo','abril','mayo','junio',
    'julio','agosto','septiembre','octubre','noviembre','diciembre'
  ];

  const DETAIL_MONTHS_ORDER = MONTHS_DESC as const;


  const totalsByMonthOfYear = useMemo(() => {
    const y = chartYear ?? availableYears[0];
    const m = new Map<string, number>();
    for (const r of data) {
      if (r.__Año === y) {
        const mes = canonMonth(r.Mes);
        m.set(mes, (m.get(mes) || 0) + (Number(r.Importe) || 0));
      }
    }
    const rows = DETAIL_MONTHS_ORDER.map(mes => ({ mes: labelMonth(mes), total: m.get(mes) || 0 }));
    return { year: y, rows };
  }, [data, chartYear, availableYears]);

  // ======= Agregaciones por MEDIO (Detalle) =======
  const mediumTotalsByYear = useMemo(() => {
    if (!selectedMedium) return [] as { label: string; total: number }[];
    const map = new Map<number, number>();
    for (const r of data) {
      const medio = (r.Medio || '').trim();
      if (medio.toLowerCase() === selectedMedium.toLowerCase()) {
        map.set(r.__Año!, (map.get(r.__Año!) || 0) + (Number(r.Importe) || 0));
      }
    }
    const rows = Array.from(map.entries()).sort((a,b)=>a[0]-b[0]).map(([y, t]) => ({ label: String(y), total: t }));
    const sum = rows.reduce((acc, r) => acc + r.total, 0);
    if (sum > 0) rows.push({ label: 'Total', total: sum });
    return rows;
  }, [selectedMedium, data]);

  const mediumTotalsMonthsOfYear = useMemo(() => {
    if (!selectedMedium) return { year: detailYear ?? null, rows: [] as { mes: string; total: number }[] };
    const y = detailYear ?? availableYears[0];
    const m = new Map<string, number>();
    for (const r of data) {
      const medio = (r.Medio || '').trim();
      if (medio.toLowerCase() === selectedMedium.toLowerCase() && r.__Año === y) {
        const mes = canonMonth(r.Mes);
        m.set(mes, (m.get(mes) || 0) + (Number(r.Importe) || 0));
      }
    }
    const rows = DETAIL_MONTHS_ORDER.map(mes => ({ mes: labelMonth(mes), total: m.get(mes) || 0 }));
    return { year: y, rows };
  }, [selectedMedium, data, detailYear, availableYears]);

  // Top 50 (todos los años) — MODIFICADO
  type TopMedio = {
    Medio: string;
    y2023: number;
    y2024: number;
    y2025: number;
    total: number;
  };

  const top50AllYears: TopMedio[] = useMemo(() => {
    const map = new Map<string, { y2023: number; y2024: number; y2025: number; total: number }>();
    for (const r of data) {
      const medio = r.Medio?.trim() || r.Proveedor?.trim() || '—';
      const y = r.__Año || 0;
      const imp = Number(r.Importe) || 0;
      if (!map.has(medio)) map.set(medio, { y2023: 0, y2024: 0, y2025: 0, total: 0 });
      const acc = map.get(medio)!;
      if (y === 2023) acc.y2023 += imp;
      else if (y === 2024) acc.y2024 += imp;
      else if (y === 2025) acc.y2025 += imp;
      acc.total += imp;
    }
    const arr: TopMedio[] = Array.from(map.entries()).map(([Medio, v]) => ({ Medio, ...v }));
    arr.sort((a, b) => b.total - a.total || a.Medio.localeCompare(b.Medio));
    return arr.slice(0, 50);
  }, [data]);

  // ÍNDICE A–Z ORDENADO POR MONTO (según año o total)
  const azCards = useMemo(() => {
    const acc = new Map<string, { y2023: number; y2024: number; y2025: number; total: number; criterio: number }>();
    for (const r of data) {
      const medio = r.Medio?.trim() || r.Proveedor?.trim();
      if (!medio) continue;
      if (!acc.has(medio)) acc.set(medio, { y2023: 0, y2024: 0, y2025: 0, total: 0, criterio: 0 });
      const a = acc.get(medio)!;
      const imp = Number(r.Importe) || 0;
      if (r.__Año === 2023) a.y2023 += imp;
      if (r.__Año === 2024) a.y2024 += imp;
      if (r.__Año === 2025) a.y2025 += imp;
      a.total += imp;
    }
    const rows = Array.from(acc.entries()).map(([Medio, v]) => {
      const criterio = yearFilter === 'all' ? v.total :
        (yearFilter === 2023 ? v.y2023 : yearFilter === 2024 ? v.y2024 : v.y2025);
      return { Medio, ...v, criterio };
    });
    rows.sort((a, b) => b.criterio - a.criterio || a.Medio.localeCompare(b.Medio));
    return rows;
  }, [data, yearFilter]);

  // A–Z filtrado por letra
  const azFiltered = useMemo(() => {
    if (azLetter === 'ALL') return azCards;
    return azCards.filter(c => firstLetterOf(c.Medio) === azLetter);
  }, [azCards, azLetter]);

  // DETALLE: búsqueda/año + orden + paginación
  const filteredDetail = useMemo(() => {
    const q = normalize(query);
    let arr = data;

    if (q) {
      arr = arr.filter(r =>
        normalize(r.Medio).includes(q) || canonMonth(r.Mes).includes(q) ||
        normalize(r.Proveedor).includes(q) ||
        canonMonth(r.Mes).includes(q) ||
        normalize(r.Resolución).includes(q)
      );
    }

    if (yearFilter !== 'all') {
      arr = arr.filter(r => r.__Año === yearFilter);
    }

    if (yearFilter !== 'all') {
      const sums = new Map<string, number>();
      arr.forEach(r => {
        const m = r.Medio || r.Proveedor;
        sums.set(m, (sums.get(m) || 0) + (Number(r.Importe) || 0));
      });
      arr.sort((a, b) => {
        const sa = sums.get(a.Medio || a.Proveedor) || 0;
        const sb = sums.get(b.Medio || b.Proveedor) || 0;
        if (sb !== sa) return sb - sa;
        if ((b.__Año || 0) !== (a.__Año || 0)) return (b.__Año || 0) - (a.__Año || 0);
        return monthRank(a.Mes) - monthRank(b.Mes);
      });
    } else {
      arr.sort((a, b) => {
        if ((b.__Año || 0) !== (a.__Año || 0)) return (b.__Año || 0) - (a.__Año || 0);
        const mr = monthRank(a.Mes) - monthRank(b.Mes);
        if (mr !== 0) return mr;
        return (Number(b.Importe) || 0) - (Number(a.Importe) || 0);
      });
    }

    return arr;
  }, [data, query, yearFilter]);

  const totalPages = Math.ceil(filteredDetail.length / pageSize);
  const paginatedDetail = useMemo(
    () => filteredDetail.slice((page - 1) * pageSize, page * pageSize),
    [filteredDetail, page]
  );

  
    // ===== Export helpers (CSV/XLS) =====
  function getExportSlice(scope: 'all' | number) {
    if (scope === 'all') return filteredDetail;
    return filteredDetail.filter(r => r.__Año === scope);
  }
function exportCSV(scope: 'all' | number) {
    const slice = getExportSlice(scope);
    const header = ['Medio', 'Proveedor', 'Mes', 'Resolución', 'Año', 'Importe'];
    const rows = slice.map(r => [
      (r.Medio || '').replace(/"/g, '""'),
      (r.Proveedor || '').replace(/"/g, '""'),
      (r.Mes || '').replace(/"/g, '""'),
      (r.Resolución || '').replace(/"/g, '""'),
      r.__Año ?? '',
      Number(r.Importe) || 0
    ]);
    const csv = [header.join(','), ...rows.map(cols => cols.map(v => (typeof v === 'string' ? `"${v}"` : String(v))).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  // Totales por Mes (Todos los años) — ORDEN DIC -> ENE
  const totalsByMonthAllYears = useMemo(() => {
    const m = new Map<string, number>();
  // Fallback seguro por si alguna ref falla: recalcula todos los años por mes (Dic->Ene)
  const getTotalsByMonthAllYears = React.useCallback(() => {
    const m = new Map<string, number>();
    for (const r of data) {
      const mes = canonMonth(r.Mes);
      m.set(mes, (m.get(mes) || 0) + (Number(r.Importe) || 0));
    }
    return DETAIL_MONTHS_ORDER.map(mes => ({ mes: labelMonth(mes), total: m.get(mes) || 0 }));
  }, [data]);

    for (const r of data) {
      const mes = canonMonth(r.Mes);
      m.set(mes, (m.get(mes) || 0) + (Number(r.Importe) || 0));
    }
    return DETAIL_MONTHS_ORDER.map(mes => ({ mes: labelMonth(mes), total: m.get(mes) || 0 }));
  }, [data]);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = scope === 'all' ? 'pauta_filtrada_todos.csv' : `pauta_filtrada_${scope}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportXLS(scope: 'all' | number) {
    const slice = getExportSlice(scope);
    const header = ['Medio', 'Proveedor', 'Mes', 'Resolución', 'Año', 'Importe'];
    const rowsHtml = slice.map(r => (
      `<tr>
        <td>${escapeHtml(r.Medio || '')}</td>
        <td>${escapeHtml(r.Proveedor || '')}</td>
        <td>${escapeHtml(r.Mes || '')}</td>
        <td>${escapeHtml(r.Resolución || '')}</td>
        <td>${r.__Año ?? ''}</td>
        <td>${Number(r.Importe) || 0}</td>
      </tr>`
    )).join('');
    const html =
`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" /></head>
<body>
  <table border="1">
    <thead><tr>${header.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = scope === 'all' ? 'pauta_filtrada_todos.xls' : `pauta_filtrada_${scope}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]!));
  }

  // === NUEVO: Conteo de proveedores (según filtro de año) ===
  const proveedoresCount = useMemo(() => {
    const set = new Set<string>();
    for (const r of data) {
      if (yearFilter === 'all' || r.__Año === yearFilter) {
        const p = (r.Proveedor || '').trim();
        if (p) set.add(p);
      }
    }
    return set.size;
  }, [data, yearFilter]);

  // Acciones UI
  function onYearChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value === 'all' ? 'all' : Number(e.target.value);
    setYearFilter(value as number | 'all');
    setExportYear(value as any);
    setQuery('');
    setQueryInput('');
    setSelectedMedium(null);
    setShareUrl('');
    const url = new URL(window.location.href);
    url.searchParams.delete('s');
    url.searchParams.delete('medio');
    history.replaceState({}, '', url.toString());
    setPage(1);
  }

  function handleSearch() {
    setSearching(true);
    setPage(1);
    setQuery(queryInput);
    const exact = queryInput.trim().toLowerCase();
    const hasExact = data.some(d => (d.Medio || '').trim().toLowerCase() === exact);
    const medio = hasExact ? queryInput.trim() : null;
    setSelectedMedium(medio);
    if (medio) toggleTrueFullscreen(); // Pantalla completa real al entrar desde búsqueda
    generateAndSetShareLink(medio);
    setTimeout(() => {
      setSearching(false);
      detailRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 250);
  }

  function clearSearch() {
    setQueryInput('');
    setQuery('');
    setSelectedMedium(null);
    setShareUrl('');
    const url = new URL(window.location.href);
    url.searchParams.delete('s');
    url.searchParams.delete('medio');
    history.replaceState({}, '', url.toString());
    setPage(1);
  }

  async function generateAndSetShareLink(medio: string | null) {
    if (!medio) return;
    const token = await encryptMedium(medio);
    const url = new URL(window.location.href);
    url.searchParams.set('s', token);
    history.replaceState({}, '', url.toString());
    setShareUrl(url.toString());
  }

  async function verAdjudicaciones(medio: string) {
    setQueryInput(medio);
    setQuery(medio);
    setSelectedMedium(medio);
    setPage(1);
    await generateAndSetShareLink(medio);
    detailRef.current?.scrollIntoView({ behavior: 'smooth' });
    toggleTrueFullscreen(); // abrir en fullscreen real
  }

  // ===== NUEVO: Fullscreen real (como F11)
async function toggleTrueFullscreen() {
  const el = detailRef.current || document.documentElement;
  try {
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' } as any);
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  } catch (e) {
    console.error('Fullscreen error', e);
  }
}


  // ===== NUEVO: Capturar a JPG
  async function captureJPG(target: 'detalle' | 'pagina' = 'pagina') {
    try {
      // Carga dinámica para evitar SSR issues
      const html2canvas = (await import('html2canvas')).default;
      const node = target === 'detalle' ? (detailRef.current ?? rootRef.current) : rootRef.current;
      if (!node) return;

      const canvas = await html2canvas(node, {
        backgroundColor: dark ? '#0b0f19' : '#f8fbff',
        scale: window.devicePixelRatio > 1 ? 2 : 1,
        useCORS: true,
        logging: false,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `captura-${target}-${stamp}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/jpeg', 0.92);
    } catch (e) {
      console.error('Error al capturar JPG:', e);
      alert('No se pudo generar la captura. Reintentá y verificá que el contenido esté visible.');
    }
  }

  // Título contextual
  const scopeTitle = yearFilter === 'all'
    ? 'Vista actual: Todos los años — Ordenado por total agregado'
    : `Vista actual: Año ${yearFilter} — Ordenado por medios con mayor total`;

  // ===== Colores de barras: ROJO FLÚOR =====
  const NEON_RED = '#ff1744';
  const barColor = NEON_RED;

  // Ajustes responsivos para charts
  const barSizeMain = bp === 'sm' ? 22 : bp === 'md' ? 30 : 38;
  const yAxisWidth = bp === 'sm' ? 52 : bp === 'md' ? 68 : 84;

  // Etiquetas según viewport
  const showYearLabels = bp === 'lg' || bp === 'xl';
  const showMonthLabels = bp === 'xl';

  // Inicializar años de gráficos cuando corresponde
  useEffect(() => {
    if (chartMode === 'monthsOfYear') {
      if (!chartYear) setChartYear(availableYears[0]);
    }
  }, [chartMode, availableYears, chartYear]);

  useEffect(() => {
    if (detailChartMode === 'months') {
      if (!detailYear) setDetailYear(availableYears[0]);
    }
  }, [detailChartMode, availableYears, detailYear]);

  return (
    <div ref={rootRef} className={`${dark ? 'bg-neutral-950 text-neutral-100' : 'bg-white text-neutral-900'}`}>
      {/* Splash de inicio CRISP */}
      {splashVisible && (
        <SplashScreen dark={dark} onDone={() => setSplashVisible(false)} />
      )}

      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet" />
      </Head>
      <style jsx global>{`
      :root{
        --g-0:#0a0a0a; --g-50:#0b0f19; --g-100:#111827; --g-200:#1f2937; --g-300:#374151; --g-400:#4b5563; --g-500:#6b7280; --g-600:#9ca3af; --g-700:#d1d5db; --g-800:#e5e7eb; --g-900:#f3f4f6; --surface:#0b1220;
        --card-bg-light:#ffffff; --card-bg-dark:#0b1220;
        --ring:#60a5fa; --brand:#0ea5e9; --brand-600:#0284c7;
        --radius:14px; --radius-sm:12px;
      }

      html, body, * { font-family: 'Roboto', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }

      .header-grad { backdrop-filter: blur(10px); }
      .toolbar { border-radius: var(--radius); padding: 10px 12px; border: 1px solid rgba(255,255,255,.06); background: rgba(255,255,255,.06); }
      :global(html.light) .toolbar { border-color: rgba(2,6,23,.08); background: rgba(2,6,23,.03); }

      .search {
        display:flex; align-items:center; gap:10px; width:100%;
        border:1px solid rgba(2,6,23,.14); border-radius:12px; padding:8px 12px; background: rgba(255,255,255,.9);
      }
      :global(html.dark) .search{ background:#0f172a; border-color:#1f2937; }
      .search input{ background:transparent; border:0; outline:0; flex:1; font-size:14px; }
      .search input::placeholder{ color: var(--g-500); }

      .btn { border-radius:12px; padding:9px 12px; border:1px solid rgba(2,6,23,.14); background:transparent; }
      .btn:hover{ background: rgba(2,6,23,.05); }
      :global(html.dark) .btn{ border-color:#1f2937; }
      :global(html.dark) .btn:hover{ background:#0f172a; }

      .btn-primary{ background: var(--brand); color:#fff; border-color: var(--brand-600); }
      .btn-primary:hover{ background: var(--brand-600); }

      .chip { border-radius: 999px; border: 1px solid rgba(2,6,23,.14); padding:4px 10px; font-size:12px; }

      .card { border-radius:16px; border:1px solid rgba(2,6,23,.12); box-shadow: 0 10px 30px rgba(0,0,0,.06); }
      :global(html.dark) .card { border-color:#1f2937; background: var(--card-bg-dark); }

      .muted{ color: var(--g-500); }
      .section-title{ font-weight:700; letter-spacing:.2px; }

      footer .wrapper{ border-top:1px solid rgba(2,6,23,.1); }
      :global(html.dark) footer .wrapper{ border-top-color:#1f2937; }
    
      .utilbar{border:1px solid rgba(2,6,23,.08); border-radius:14px;}
    `}</style>

      {/* Modal de inicio */}
      <IntroModal open={showIntro} onClose={() => setShowIntro(false)} dark={dark} />

      {/* Header */}
      <header className={`sticky top-0 z-30 border-b ${dark ? 'border-neutral-800' : 'border-neutral-200'} header-grad backdrop-blur shadow-md rounded-b-xl`}> 
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={toggleTheme}
              aria-label="Cambiar tema"
              className="btn btn-soft flex items-center gap-2"
              title={dark ? 'Modo claro' : 'Modo oscuro'}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="hidden sm:inline text-sm">{dark ? 'Claro' : 'Oscuro'}</span>
            </button>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[18px] sm:text-[20px] md:text-2xl font-extrabold tracking-tight"
              style={{ lineHeight: 1.2 }}
            >
              Pauta oficial provincia de Buenos Aires
            </motion.h1>
          </div>

          {/* Export & Captura controls */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="btn btn-soft text-sm min-w-[200px]"
              value={exportYear as any}
              onChange={(e) => setExportYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">Exportar: Todos los años</option>
              {availableYears.map(y => <option key={y} value={y}>Exportar: {y}</option>)}
            </select>

            <button onClick={() => exportCSV(exportYear)} className="btn text-sm inline-flex items-center gap-2">
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
            <button onClick={() => exportXLS(exportYear)} className="btn text-sm inline-flex items-center gap-2">
              <Download className="h-4 w-4" /> Exportar XLS
            </button>

            {/* NUEVO: Captura JPG de la página */}
            <button onClick={() => captureJPG('pagina')} className="btn text-sm inline-flex items-center gap-2" title="Capturar toda la página en JPG">
              <Camera className="h-4 w-4" /> Capturar JPG
            </button>
          </div>
        </div>
        {/* SUBHEADER */}
        <div className={`${dark ? 'bg-neutral-900 text-neutral-100' : 'bg-[#f0faff] text-[#0b4b66]'} border-t ${dark ? 'border-neutral-800' : 'border-[#bae6fd]'} py-2`}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 text-[13px] md:text-[15px] font-medium text-center tracking-tight opacity-95">
            {scopeTitle}
          </div>
        </div>
      </header>

{/* Utility Toolbar: búsqueda + compartir + exportar + capturar */}
<div data-ui='utility-toolbar' className="w-full">
  <div className="mx-auto max-w-7xl px-5 sm:px-8 py-3 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
    <div className="flex-1">
      <div className="search" role="search">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5m-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14"/></svg>
        <input
          type="search"
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
          placeholder="Buscar en todos los años (medio, proveedor, resolución, mes)..."
          aria-label="Buscar"
        />
      
        {query ? (
          <button
            title="Limpiar búsqueda"
            aria-label="Limpiar búsqueda"
            className="btn-ghost"
            onClick={() => setQuery('')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x h-4 w-4 opacity-70"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
          </button>
        ) : null}
        <button
          className="btn btn-primary text-sm inline-flex items-center gap-2 min-w-[108px] justify-center"
          onClick={() => { scrollToResults(); setTimeout(scrollToFirstMatch, 250); }}
          title="Buscar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search h-4 w-4"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
          Buscar
        </button>
    </div>
    </div>
    <div className="flex items-center gap-2">
      <button
        className="btn btn-ghost text-sm inline-flex items-center gap-2"
        onClick={() => {
          try {
            if (navigator.share) {
              navigator.share({ title: document.title, text: 'Compartir esta vista', url: location.href });
  // Auto-scroll al primer match cuando hay búsqueda
  useEffect(() => {
    if (query && query.trim().length > 0) {
      const t = setTimeout(() => scrollToFirstMatch(), 200);
      return () => clearTimeout(t);
    }
  }, [query, scrollToFirstMatch]);

  useEffect(() => {
    if (chartMode === 'monthsOfYear') {
      if (yearFilter === 'all') {
        if (!chartYear) setChartYear(availableYears[0]);
      } else if (typeof yearFilter === 'number' && chartYear !== yearFilter) {
        setChartYear(yearFilter);
      }
    }
  }, [chartMode, yearFilter, chartYear, availableYears]);

            } else {
              navigator.clipboard?.writeText(location.href);
              alert('Enlace copiado.');
            }
          } catch {}
        }}
        title="Compartir"
      >
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.02-4.11A2.99 2.99 0 0 0 18 7.91A3 3 0 1 0 15 5c0 .24.04.47.09.7L8.07 9.81A2.996 2.996 0 0 0 6 9a3 3 0 1 0 2.91 3.7l7.12 4.17c-.02.16-.03.32-.03.48a3 3 0 1 0 3-3z"/></svg>
        Compartir
      </button>
      <button
        className="btn text-sm inline-flex items-center gap-2"
        onClick={() => { try { exportCSV?.('all') } catch {} }}
        title="Exportar CSV (vista)"
      >
        CSV
      </button>
      <button
        className="btn text-sm inline-flex items-center gap-2"
        onClick={() => { try { captureJPG?.('detalle') } catch {} }}
        title="Capturar JPG (Detalle)"
      >
        Capturar
      </button>
    </div>
  </div>
</div>


      <main className="mx-auto max-w-7xl px-3 sm:px-4 py-6 space-y-8">
        {/* Gráfico principal */}
        <section className={`card p-3 sm:p-4 ${dark ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
            <div>
              <h3 className="text-lg sm:text-xl section-title">Gráfico principal</h3>
              <div className="text-xs sm:text-sm opacity-80 mt-1">
                {chartMode === 'yearTotals' ? <>Todos los años</> : <>Meses del año {totalsByMonthOfYear.year}</>}
              </div>
              {/* NUEVO: Proveedores */}
              <div className="text-[11px] sm:text-xs mt-1 opacity-80">
                Proveedores en esta vista: <strong>{proveedoresCount.toLocaleString('es-AR')}</strong>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className="btn btn-soft text-sm"
                value={chartMode}
                onChange={(e) => setChartMode(e.target.value as ChartMode)}
                title="Modo de gráfico"
              >
                <option value="yearTotals">Todos los años</option>
                <option value="monthsOfYear">Meses del año</option>
              </select>
              <select
                aria-label="Filtrar por año"
                className="btn btn-soft text-sm"
                value={yearFilter as any}
                onChange={(e) => setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                title="Filtrar por año (incluye 'Todos los años')"
              >
                <option value="all">Todos los años</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>

              {chartMode === 'monthsOfYear' && (
                <select
                  className="btn btn-soft text-sm"
                  value={(chartYear ?? availableYears[0]) as any}
                  onChange={(e) => setChartYear(Number(e.target.value))}
                  title="Elegí el año"
                >
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="mt-3 h-56 sm:h-64 md:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'yearTotals' ? (
                <BarChart data={totalsByYear} barSize={barSizeMain} margin={{ top: 64, right: 12, bottom: 10, left: yAxisWidth }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={dark ? '#374151' : '#cfeffd'} />
                  <XAxis dataKey="year" stroke={dark ? '#d1d5db' : '#0b4b66'} />
                  <YAxis
                    width={yAxisWidth}
                    tick={{ fontSize: bp === 'sm' ? 11 : 12, fill: dark ? '#d1d5db' : '#0b4b66' }}
                    domain={[0, (dataMax: number) => (dataMax || 0) * (bp === 'sm' ? 1.12 : 1.18)]}
                    tickFormatter={v => currencyFormatter.format(v).replace(/^\$\s?/, '$')}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ background: dark ? '#0b1220' : '#f0fbff', border: `1px solid ${dark ? '#374151' : '#bae6fd'}`, color: dark ? '#fff' : '#0b4b66', padding: bp === 'sm' ? 10 : 8 }}
                    formatter={(val: any) => currencyFormatter.format(Number(val))}
                    labelFormatter={(lbl) => `Año ${lbl}`}
                  />
                  <Bar dataKey="total" radius={[12, 12, 0, 0]} fill={barColor}>
                    {showYearLabels && (
                      <LabelList
                        dataKey="total"
                        position="top"
                        offset={10}
                        content={(props: any) => <ValueLabel {...props} dark={dark} compact={false} />}
                      />
                    )}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart data={(yearFilter === 'all' ? (typeof totalsByMonthAllYears !== 'undefined' ? totalsByMonthAllYears : getTotalsByMonthAllYears()) : totalsByMonthOfYear.rows)} barSize={bp === 'sm' ? 20 : bp === 'md' ? 26 : 32} margin={{ top: 64, right: 12, bottom: 10, left: yAxisWidth }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={dark ? '#374151' : '#cfeffd'} />
                  <XAxis
                    dataKey="mes"
                    stroke={dark ? '#d1d5db' : '#0b4b66'}
                    interval={0}
                    angle={bp === 'sm' ? -35 : 0}
                    textAnchor={bp === 'sm' ? 'end' : 'middle'}
                    tickMargin={8}
                    tick={{
                      fontSize: bp === 'sm' ? 10 : 11,
                      dy: bp === 'sm' ? 8 : 0,
                    }}
                  />
                  <YAxis
                    width={yAxisWidth}
                    tick={{ fontSize: bp === 'sm' ? 11 : 12, fill: dark ? '#d1d5db' : '#0b4b66' }}
                    domain={[0, (dataMax: number) => (dataMax || 0) * (bp === 'sm' ? 1.12 : 1.22)]}
                    tickFormatter={v => currencyFormatter.format(v).replace(/^\$\s?/, '$')}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{ background: dark ? '#0b1220' : '#f0fbff', border: `1px solid ${dark ? '#374151' : '#bae6fd'}`, color: dark ? '#fff' : '#0b4b66', padding: bp === 'sm' ? 10 : 8 }}
                    formatter={(val: any) => currencyFormatter.format(Number(val))}
                    labelFormatter={() => `Año ${totalsByMonthOfYear.year}`}
                  />
                  <Bar dataKey="total" radius={[12, 12, 0, 0]} fill={barColor}>
                    {showMonthLabels && (
                      <LabelList
                        dataKey="total"
                        position="top"
                        offset={10}
                        content={(props: any) => <ValueLabel {...props} dark={dark} compact={true} />}
                      />
                    )}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        {/* Buscador + Año */}
        <section className="grid gap-3 md:grid-cols-3">
          <select className={`btn btn-soft text-sm`} value={yearFilter as any} onChange={onYearChange} aria-label="Filtrar por año">
            <option value="all">Todos los años</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </section>

        {/* Botones Top 50 / A–Z */}
        <section className={`card p-3 sm:p-4 ${dark ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
          {/* Top 50 — MODIFICADO */}
          <button
            onClick={() => setTopOpen(o => !o)}
            className="w-full flex items-center justify-between btn btn-primary text-left"
            aria-expanded={topOpen}
          >
            <span className="font-semibold">Top 50 (todos los años)</span>
            {topOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <AnimatePresence initial={false}>
            {topOpen && (
              <motion.div
                key="top50"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {top50AllYears.map((row, i) => (
                    <div key={row.Medio} className={`card p-3 ${dark ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${dark ? 'bg-neutral-700' : 'bg-neutral-100'}`}>
                          {i + 1}
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => verAdjudicaciones(row.Medio)}
                            className="text-white/90 hover:text-white"
                            title="Ver y generar link"
                          >
                            <LinkIcon className="h-4 w-4" />
                          </button>
                          <button onClick={() => verAdjudicaciones(row.Medio)} className="text-blue-500" title="Ver adjudicaciones">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => verAdjudicaciones(row.Medio)}
                        className="font-semibold mb-2 text-left underline-offset-2 hover:underline"
                        title="Ver adjudicaciones del medio"
                      >
                        {row.Medio}
                      </button>
                      <div className="grid grid-cols-2 gap-x-2 text-sm">
                        <div>2023</div><div>{currencyFormatter.format(row.y2023)}</div>
                        <div>2024</div><div>{currencyFormatter.format(row.y2024)}</div>
                        <div>2025</div><div>{currencyFormatter.format(row.y2025)}</div>
                        <div className="font-medium mt-1">Total</div>
                        <div className="font-medium mt-1">{currencyFormatter.format(row.total)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Separador */}
          <div className="mt-4" />

          {/* Índice A–Z */}
          <button
            onClick={() => setAzOpen(o => !o)}
            className="w-full flex items-center justify-between btn btn-primary text-left"
            aria-expanded={azOpen}
          >
            <span className="font-semibold">Índice A–Z de medios</span>
            {azOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          <AnimatePresence initial={false}>
            {azOpen && (
              <motion.div
                key="az"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-3"
              >
                <div className={`mb-4 p-2.5 sm:px-3 sm:py-3 ${dark ? 'bg-neutral-900 text-neutral-100' : 'bg-[#f0faff] text-[#0b4b66]'} rounded-xl border ${dark ? 'border-neutral-700' : 'border-[#bae6fd]'}`}>
                  <div className="text-sm font-semibold mb-2">Índice A–Z</div>
                  <div className="no-scrollbar overflow-x-auto sm:overflow-visible">
                    <div className="flex sm:flex-wrap gap-2 min-w-max sm:min-w-0">
                      <button
                        onClick={() => setAzLetter('ALL')}
                        className={`chip ${azLetter === 'ALL' ? (dark ? 'bg-neutral-800' : 'bg-white') : ''}`}
                        title="Todos"
                      >
                        Todos
                      </button>
                      {letters.map(letter => (
                        <button
                          key={letter}
                          onClick={() => setAzLetter(letter as any)}
                          className={`chip ${azLetter === letter ? (dark ? 'bg-neutral-800' : 'bg-white') : ''}`}
                          title={`Filtrar por ${letter === '#' ? '0–9 / Otros' : letter}`}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-xs opacity-70 mb-2">
                  {yearFilter === 'all'
                    ? 'Índice A–Z ordenado por total (2023+2024+2025), de mayor a menor.'
                    : `Índice A–Z ordenado por total del año ${yearFilter}, de mayor a menor.`}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {azFiltered.map(card => (
                    <div key={card.Medio} className={`card p-3 ${dark ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <button
                          id={`medio-${normalize(card.Medio).replace(/\s+/g,"-")}`}
                          onClick={() => verAdjudicaciones(card.Medio)}
                          className="font-semibold text-left underline-offset-2 hover:underline"
                          title="Ver adjudicaciones del medio"
                        >
                          {card.Medio}
                        </button>
                        <div className="flex items-center gap-3">
                          <button onClick={() => verAdjudicaciones(card.Medio)} className="text-white/90 hover:text-white" title="Generar link">
                            <LinkIcon className="h-4 w-4" />
                          </button>
                          <button onClick={() => verAdjudicaciones(card.Medio)} className="text-blue-500" title="Ver adjudicaciones">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 text-sm">
                        <div>2023</div><div>{currencyFormatter.format(card.y2023)}</div>
                        <div>2024</div><div>{currencyFormatter.format(card.y2024)}</div>
                        <div>2025</div><div>{currencyFormatter.format(card.y2025)}</div>
                        <div className="font-medium mt-1">Total</div>
                        <div className="font-medium mt-1">{currencyFormatter.format(card.total)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Detalle (Elemento objetivo de fullscreen real y capturas) */}
        <section
          ref={detailRef}
          className={`card p-3 sm:p-4 ${dark ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}
          style={detailFullscreen ? { background: dark ? '#0b0f19' : '#f8fbff' } : undefined}
        >
          {/* Barra superior del detalle */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 ${detailFullscreen ? 'sticky top-0 pt-1 pb-2 z-[10000]' : ''}`}>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl section-title">Detalle de adjudicaciones</h3>
              <button
                onClick={toggleTrueFullscreen}
                className="btn text-sm inline-flex items-center gap-2"
                title={detailFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                {detailFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {detailFullscreen ? 'Salir' : 'Pantalla completa'}
              </button>
              {/* NUEVO: Captura del bloque de detalle */}
              <button
                onClick={() => captureJPG('detalle')}
                className="btn text-sm inline-flex items-center gap-2"
                title="Capturar este bloque en JPG"
              >
                <Camera className="h-4 w-4" /> Capturar detalle
              </button>
            </div>

            {/* Sharing UI cuando hay medio */}
            {selectedMedium && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                <div className="text-sm opacity-80">Medio: <strong>{selectedMedium}</strong></div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!shareUrl) {
                        await generateAndSetShareLink(selectedMedium);
                      }
                      await navigator.clipboard.writeText(shareUrl || window.location.href);
                      setCopyOk(true);
                      setTimeout(() => setCopyOk(false), 1200);
                    }}
                    className="btn text-sm inline-flex items-center gap-2"
                    title="Copiar link para compartir"
                  >
                    <LinkIcon className="h-4 w-4" /> Copiar link
                  </button>
                  {copyOk && <span className="text-xs opacity-80">¡Copiado!</span>}
                </div>
              </div>
            )}
          </div>

          {/* Gráfico por medio seleccionado */}
          {selectedMedium && (
            <div className="mb-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-2">
                <div className="text-sm sm:text-base font-semibold">Resumen del medio: {selectedMedium}</div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="btn btn-soft text-sm"
                    value={detailChartMode}
                    onChange={(e) => setDetailChartMode(e.target.value as DetailChartMode)}
                    title="Modo del gráfico"
                  >
                    <option value="years">Todos los años</option>
                    <option value="months">Meses de un año</option>
                  </select>

                  {detailChartMode === 'months' && (
                    <select
                      className="btn btn-soft text-sm"
                      value={(detailYear ?? availableYears[0]) as any}
                      onChange={(e) => setDetailYear(Number(e.target.value))}
                      title="Elegí el año"
                    >
                      {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div className="h-48 sm:h-56 md:h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {detailChartMode === 'years' ? (
                    <BarChart data={mediumTotalsByYear} barSize={bp === 'sm' ? 22 : 30} margin={{ top: 48, right: 16, bottom: 10, left: yAxisWidth }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={dark ? '#374151' : '#cfeffd'} />
                      <XAxis dataKey="label" stroke={dark ? '#d1d5db' : '#0b4b66'} />
                      <YAxis
                        width={yAxisWidth}
                        tick={{ fontSize: bp === 'sm' ? 11 : 12, fill: dark ? '#d1d5db' : '#0b4b66' }}
                        domain={[0, (dataMax: number) => (dataMax || 0) * (bp === 'sm' ? 1.12 : 1.18)]}
                        tickFormatter={v => currencyFormatter.format(v).replace(/^\$\s?/, '$')}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{ background: dark ? '#0b1220' : '#f0fbff', border: `1px solid ${dark ? '#374151' : '#bae6fd'}`, color: dark ? '#fff' : '#0b4b66', padding: bp === 'sm' ? 10 : 8 }}
                        formatter={(val: any) => currencyFormatter.format(Number(val))}
                        labelFormatter={(lbl) => (lbl === 'Total' ? 'Total 2023–2025' : `Año ${lbl}`)}
                      />
                      <Bar dataKey="total" radius={[12, 12, 0, 0]} fill={barColor}>
                        {(bp === 'lg' || bp === 'xl') && (
                          <LabelList
                            dataKey="total"
                            position="top"
                            offset={10}
                            content={(props: any) => <ValueLabel {...props} dark={dark} compact={false} />}
                          />
                        )}
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={mediumTotalsMonthsOfYear.rows} barSize={bp === 'sm' ? 18 : 26} margin={{ top: 58, right: 16, bottom: 10, left: yAxisWidth }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={dark ? '#374151' : '#cfeffd'} />
                      <XAxis
                        dataKey="mes"
                        stroke={dark ? '#d1d5db' : '#0b4b66'}
                        interval={0}
                        angle={bp === 'sm' ? -35 : 0}
                        textAnchor={bp === 'sm' ? 'end' : 'middle'}
                        tickMargin={8}
                        tick={{
                          fontSize: bp === 'sm' ? 10 : 11,
                          dy: bp === 'sm' ? 8 : 0,
                        }}
                      />
                      <YAxis
                        width={yAxisWidth}
                        tick={{ fontSize: bp === 'sm' ? 11 : 12, fill: dark ? '#d1d5db' : '#0b4b66' }}
                        domain={[0, (dataMax: number) => (dataMax || 0) * (bp === 'sm' ? 1.12 : 1.22)]}
                        tickFormatter={v => currencyFormatter.format(v).replace(/^\$\s?/, '$')}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{ background: dark ? '#0b1220' : '#f0fbff', border: `1px solid ${dark ? '#374151' : '#bae6fd'}`, color: dark ? '#fff' : '#0b4b66', padding: bp === 'sm' ? 10 : 8 }}
                        formatter={(val: any) => currencyFormatter.format(Number(val))}
                        labelFormatter={() => `Año ${mediumTotalsMonthsOfYear.year}`}
                      />
                      <Bar dataKey="total" radius={[12, 12, 0, 0]} fill={barColor}>
                        {bp === 'xl' && (
                          <LabelList
                            dataKey="total"
                            position="top"
                            offset={10}
                            content={(props: any) => <ValueLabel {...props} dark={dark} compact={true} />}
                          />
                        )}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Grid de tarjetas de adjudicaciones */}
          <div className={`grid grid-cols-1 ${detailFullscreen ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'} gap-3`}>
            {paginatedDetail.map((r, i) => {
              const url = pdfUrl(r);
              const medioNombre = r.Medio || r.Proveedor;
              return (
                <div key={`${r.Medio}-${r.Proveedor}-${r.Resolución}-${i}`} className={`card p-3 ${dark ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
                  <button
                    onClick={() => verAdjudicaciones(medioNombre)}
                    className="font-semibold mb-1 text-left underline-offset-2 hover:underline"
                    title="Ver gráfico y adjudicaciones de este medio"
                  >
                    {medioNombre}
                  </button>

                  <div className="text-sm opacity-80 break-words">{r.Proveedor}</div>
                  <div className="text-sm">Año: {r.__Año} — Mes: {r.Mes}</div>
                  <div className="text-sm break-words">Resolución: {r.Resolución}</div>
                  <div className="font-medium mt-1">{currencyFormatter.format(Number(r.Importe) || 0)}</div>
                  {url && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <a href={url} target="_blank" className="text-blue-500 hover:underline">Ver PDF</a>
                      <a href={url} download className="text-blue-500 hover:underline">Descargar</a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="btn btn-soft disabled:opacity-50 w-full sm:w-auto">
                Anterior
              </button>
              <span className="text-sm">Página {page} de {totalPages}</span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="btn btn-soft disabled:opacity-50 w-full sm:w-auto">
                Siguiente
              </button>
            </div>
          )}
        </section>
      </main>

    
      <footer className={`border-t ${dark ? 'border-neutral-800' : 'border-neutral-200'} py-6 text-center text-sm ${dark ? 'text-neutral-300' : 'text-neutral-600'}`}>
        <div className="px-3 sm:px-4">
          La vigilancia eterna es el precio de la libertad · Sitio realizado por ⛧{' '}
          <a href="https://x.com/innomtek" target="_blank" className="underline">
            @innomtek


          </a>
          <div className="mt-3 sm:mt-2 flex flex-col items-center gap-2">
            <span>Pueden donarme si quieren a:</span>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-black text-white px-3 py-1 rounded-md break-words">
              <code className="text-xs">0x11514999830E4bCCb5D77f679cc6be7A75cc79DE</code>
              <button
                onClick={() => navigator.clipboard.writeText('0x11514999830E4bCCb5D77f679cc6be7A75cc79DE')}
                className="hover:text-blue-400"
                title="Copiar dirección"
              >
                <CopyIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs opacity-80">
              Red Binance Smart Chain / Ethereum / Polygon
            </div>

            <div className="text-xs opacity-80">
              Fuente: https://normas.gba.gob.ar - Ultima actualización 11/11/2025 #PAUTAPBA
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
