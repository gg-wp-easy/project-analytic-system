import { nkPalette } from "./nk-palette";

/** Цвета бренда для кода (генерирует nk-tech-brand/palette.mjs); в стилях — переменные --nk-*. */
export { nkMantineDark, nkPalette, type NkColorScheme } from "./nk-palette";

/** Категориальные цвета графиков бренда — CSS-переменные, подстраиваются под тему. */
export const VIZ_COLORS = nkPalette.light.viz.map((_, index) => `var(--nk-viz-${index + 1})`);

/** Те же цвета в hex (светлая тема) — для диаграмм, которые уходят в PNG/PDF: там переменных нет. */
export const VIZ_HEX: string[] = [...nkPalette.light.viz];
