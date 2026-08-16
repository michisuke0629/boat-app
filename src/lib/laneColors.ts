import type { CSSProperties } from 'react';

// 枠番の色（レイアウトExcelの塗りつぶし色に準拠: 1白/2黒/3赤/4青/5黄/6緑）
export const LANE_COLORS: Record<number, { bg: string; text: string; border?: boolean }> = {
  1: { bg: '#FFFFFF', text: '#000000', border: true },
  2: { bg: '#000000', text: '#FFFFFF' },
  3: { bg: '#FF0000', text: '#FFFFFF' },
  4: { bg: '#0000FF', text: '#FFFFFF' },
  5: { bg: '#FFFF00', text: '#000000' },
  6: { bg: '#008000', text: '#FFFFFF' },
};

// 1枠は白地で背景に埋もれるため、境界線もまとめてスタイルに含めて確実に反映させる
export function laneColorStyle(entryNumber: number): CSSProperties {
  const c = LANE_COLORS[entryNumber];
  if (!c) return { backgroundColor: '#1995AD', color: '#FFFFFF' };
  return {
    backgroundColor: c.bg,
    color: c.text,
    ...(c.border ? { boxShadow: 'inset 0 0 0 1px #9CA3AF' } : {}),
  };
}
