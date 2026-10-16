/* NK-Tech Finance — палитра бренда для кода: темы Mantine, графики на canvas, экспорт картинок.
   Сгенерировано nk-tech-brand/palette.mjs из palette/palette.json — не править вручную.
   В стилях те же цвета — CSS-переменные --nk-* из nk-palette.css. */

export const nkPalette = {
  gradient: 'linear-gradient(120deg, #ff4d6d, #8b5cf6 55%, #38b6ff)',
  gradientStops: ['#ff4d6d', '#8b5cf6', '#38b6ff'],
  emblemGradient: 'linear-gradient(135deg, #ff5a40, #e3142f 38%, #a30c24 78%, #6a0715)',
  /** основной цвет интерфейсов, где малиновый занят убытком и риском; ступени 50…950 */
  violet: ['#f3f0ff', '#e7e0ff', '#cfc1ff', '#b39eff', '#9a7dff', '#8b6bff', '#7c5cff', '#6a4ae6', '#5a3bc9', '#462e9e', '#2e1d6b'],
  light: {
    bg: '#fff6f8',
    surface: '#ffffff',
    surface2: '#fff0f3',
    border: '#f0d3da',
    text: '#241a33',
    muted: '#776a90',
    accent: '#e0284f',
    accent2: '#7455e6',
    cyan: '#0ea5d6',
    accentText: '#c81d45',
    accentSoft: '#ffe1e7',
    hover: '#fff0f3',
    grid: '#f6e2e6',
    star: '#f0a020',
    up: '#0f9d76',
    down: '#e5365e',
    overlay: 'rgba(36, 26, 51, 0.5)',
    neutral: ['#fff6f8', '#fff0f3', '#f0d3da', '#e0bcc8', '#a896b8', '#776a90', '#5f5379', '#483d61', '#352a4b', '#241a33', '#160f22'],
    viz: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
    vizMuted: '#898781',
  },
  dark: {
    bg: '#0a0c1a',
    surface: '#14172c',
    surface2: '#101328',
    border: '#282c52',
    text: '#eef0ff',
    muted: '#9ba1cc',
    accent: '#ff4d6d',
    accent2: '#7c5cff',
    cyan: '#4fd8ff',
    accentText: '#ff8aa1',
    accentSoft: 'rgba(255, 77, 109, 0.16)',
    hover: '#1b1f42',
    grid: '#21254a',
    star: '#ffd166',
    up: '#35e0a1',
    down: '#ff5c7c',
    overlay: 'rgba(4, 5, 16, 0.7)',
    neutral: ['#f6f7ff', '#eef0ff', '#dde0f8', '#c9cdee', '#9ba1cc', '#6f75a3', '#4a4f80', '#363b6b', '#282c52', '#14172c', '#0a0c1a'],
    viz: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    vizMuted: '#898781',
  },
} as const;

export type NkColorScheme = 'light' | 'dark';

/** Шкала `dark` для Mantine: 0 — текст тёмной темы, 7 — карточки, 9 — фон страницы. */
export const nkMantineDark = ['#eef0ff', '#c9cdee', '#9ba1cc', '#6f75a3', '#363b6b', '#282c52', '#1b1f42', '#14172c', '#101328', '#0a0c1a'] as const;
