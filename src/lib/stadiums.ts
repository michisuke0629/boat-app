// 競艇場マスタ（jcd = race_stadium_number, 01〜24固定・BoatraceOpenAPIには含まれないためハードコード）

export interface Stadium {
  number: number;
  name: string;
}

export const STADIUMS: Stadium[] = [
  { number: 1, name: '桐生' },
  { number: 2, name: '戸田' },
  { number: 3, name: '江戸川' },
  { number: 4, name: '平和島' },
  { number: 5, name: '多摩川' },
  { number: 6, name: '浜名湖' },
  { number: 7, name: '蒲郡' },
  { number: 8, name: '常滑' },
  { number: 9, name: '津' },
  { number: 10, name: '三国' },
  { number: 11, name: 'びわこ' },
  { number: 12, name: '住之江' },
  { number: 13, name: '尼崎' },
  { number: 14, name: '鳴門' },
  { number: 15, name: '丸亀' },
  { number: 16, name: '児島' },
  { number: 17, name: '宮島' },
  { number: 18, name: '徳山' },
  { number: 19, name: '下関' },
  { number: 20, name: '若松' },
  { number: 21, name: '芦屋' },
  { number: 22, name: '福岡' },
  { number: 23, name: '唐津' },
  { number: 24, name: '大村' },
];

export function stadiumName(stadiumNumber: number): string {
  return STADIUMS.find((s) => s.number === stadiumNumber)?.name ?? `第${stadiumNumber}場`;
}

// jcdクエリパラメータ用（2桁ゼロ埋め文字列）
export function jcdParam(stadiumNumber: number): string {
  return String(stadiumNumber).padStart(2, '0');
}

// 決まり手コード（result.technique_number）。3=まくりを公式サイトと突合して確認済み。
export const TECHNIQUE_NAMES: Record<number, string> = {
  1: '逃げ',
  2: '差し',
  3: 'まくり',
  4: 'まくり差し',
  5: '抜き',
  6: '恵まれ',
};

export function techniqueName(techniqueNumber: number | null): string {
  if (techniqueNumber === null) return '不明';
  return TECHNIQUE_NAMES[techniqueNumber] ?? '不明';
}
