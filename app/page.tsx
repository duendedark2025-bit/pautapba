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

function yearFromFilename(name: string): number {
  const m = name.match(/(20\d{2})/);
  return m ? parseInt(m[1], 10) : 0;
}

// URL PDF robusta
function pdfUrl(r: Registro): string | null {
  if (!r.__Año || !r.Mes || !r.Resolución) return null;
  const mes = r.Mes.charAt(0).toUpperCase() + r.Mes.slice(1).toLowerCase();
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
// Página principal
// =========================
export default function Page() {
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

  const totalsByMonthOfYear = useMemo(() => {
    const y = chartYear ?? availableYears[0];
    const m = new Map<string, number>();
    for (const r of data) {
      if (r.__Año === y) {
        const mes = normalize(r.Mes);
        m.set(mes, (m.get(mes) || 0) + (Number(r.Importe) || 0));
      }
    }
    const rows = MONTHS_ORDER.map(mes => ({
      mes: mes.charAt(0).toUpperCase() + mes.slice(1),
      total: m.get(mes) || 0
    }));
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
        const mes = normalize(r.Mes);
        m.set(mes, (m.get(mes) || 0) + (Number(r.Importe) || 0));
      }
    }
    const rows = MONTHS_ORDER.map(mes => ({
      mes: mes.charAt(0).toUpperCase() + mes.slice(1),
      total: m.get(mes) || 0
    }));
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
        normalize(r.Medio).includes(q) ||
        normalize(r.Proveedor).includes(q) ||
        normalize(r.Mes).includes(q) ||
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
        return normalize(b.Mes).localeCompare(normalize(a.Mes));
      });
    } else {
      arr.sort((a, b) => {
        if ((b.__Año || 0) !== (a.__Año || 0)) return (b.__Año || 0) - (a.__Año || 0);
        const byMes = normalize(b.Mes).localeCompare(normalize(a.Mes));
        if (byMes !== 0) return byMes;
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
    <div ref={rootRef} className={`${dark ? 'bg-neutral-900 text-neutral-100' : 'bg-neutral-50 text-neutral-900'}`}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&display=swap" rel="stylesheet" />
      </Head>
      <style jsx global>{`
        html, body, * { font-family: 'Roboto', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        .card { border-radius: 14px; box-shadow: ${dark ? '0 6px 24px rgba(0,0,0,.35)' : '0 6px 24px rgba(0,0,0,.08)'}; }
        .btn { border-radius: 12px; padding: 8px 12px; }
        .btn-soft { background: ${dark ? '#1f2937' : '#ffffff'}; border: 1px solid ${dark ? '#374151' : '#e5e7eb'}; color: inherit; }
        .btn-primary { background: #2563eb; color: #fff; }
        .chip { font-size: 12px; padding: 4px 8px; border-radius: 999px; border: 1px solid ${dark ? '#374151' : '#e5e7eb'}; background: ${dark ? '#111827' : '#fff'}; }
        .header-grad { background: linear-gradient(90deg, ${dark ? '#0b1220' : '#ffffff'}, ${dark ? '#0f172a' : '#f0faff'}); }
        a:hover { opacity: .9 }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Modal de inicio */}
      <IntroModal open={showIntro} onClose={() => setShowIntro(false)} dark={dark} />

      {/* Header */}
      <header className={`sticky top-0 z-30 border-b ${dark ? 'border-neutral-800' : 'border-neutral-200'} header-grad backdrop-blur`}> 
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
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

            <button onClick={() => exportCSV(exportYear)} className="btn btn-soft text-sm inline-flex items-center gap-2">
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
            <button onClick={() => exportXLS(exportYear)} className="btn btn-soft text-sm inline-flex items-center gap-2">
              <Download className="h-4 w-4" /> Exportar XLS
            </button>

            {/* NUEVO: Captura JPG de la página */}
            <button onClick={() => captureJPG('pagina')} className="btn btn-soft text-sm inline-flex items-center gap-2" title="Capturar toda la página en JPG">
              <Camera className="h-4 w-4" /> Capturar JPG
            </button>
          </div>
        </div>
        {/* SUBHEADER */}
        <div className={`${dark ? 'bg-neutral-900 text-neutral-100' : 'bg-[#f0faff] text-[#0b4b66]'} border-t ${dark ? 'border-neutral-800' : 'border-[#bae6fd]'} py-2`}>
          <div className="mx-auto max-w-7xl px-3 sm:px-4 text-sm md:text-base font-semibold text-center">
            {scopeTitle}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 sm:px-4 py-6 space-y-8">
        {/* Gráfico principal */}
        <section className={`card p-3 sm:p-4 ${dark ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
            <div>
              <h3 className="text-base sm:text-lg font-semibold">Gráfico principal</h3>
              <div className="text-xs sm:text-sm opacity-80 mt-1">
                {chartMode === 'yearTotals'
                  ? <>Total por año · Total acumulado: <strong>{currencyFormatter.format(grandTotal)}</strong></>
                  : <>Meses del año {totalsByMonthOfYear.year}</>
                }
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
                <option value="yearTotals">Total por año</option>
                <option value="monthsOfYear">Meses de un año</option>
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
                <BarChart data={totalsByMonthOfYear.rows} barSize={bp === 'sm' ? 20 : bp === 'md' ? 26 : 32} margin={{ top: 64, right: 12, bottom: 10, left: yAxisWidth }}>
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
          <div className="md:col-span-2 flex gap-2">
            <div className={`flex items-center gap-2 card p-2.5 sm:p-3 w/full ${''} ${dark ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'}`}>
              <Search className="h-5 w-5 opacity-70" />
              <input
                value={queryInput}
                onChange={e => setQueryInput(e.target.value)}
                placeholder="Buscar en todos los años (medio, proveedor, resolución, mes)..."
                className={`w-full outline-none bg-transparent text-sm sm:text-base`}
              />
              {query && (
                <button onClick={clearSearch} title="Limpiar búsqueda" aria-label="Limpiar búsqueda">
                  <XIcon className="h-4 w-4 opacity-70" />
                </button>
              )}
            </div>
            <button onClick={handleSearch} className="btn btn-primary text-sm inline-flex items-center gap-2 min-w-[108px] justify-center">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </button>
          </div>

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
              <h3 className="text-base sm:text-lg font-semibold">Detalle de adjudicaciones</h3>
              <button
                onClick={toggleTrueFullscreen}
                className="btn btn-soft text-sm inline-flex items-center gap-2"
                title={detailFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                {detailFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {detailFullscreen ? 'Salir' : 'Pantalla completa'}
              </button>
              {/* NUEVO: Captura del bloque de detalle */}
              <button
                onClick={() => captureJPG('detalle')}
                className="btn btn-soft text-sm inline-flex items-center gap-2"
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
                    className="btn btn-soft text-sm inline-flex items-center gap-2"
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
          <a href="https://x.com/thesau3n" target="_blank" className="underline">
            @thesau3n
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
              Fuente: https://normas.gba.gob.ar - Ultima actualización 02/10/2025 #KICILLOFHDRMP
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
