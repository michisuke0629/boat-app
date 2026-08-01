// ホーム画面のマトリクス・各競艇場ページ共通で使うメニュー定義

export interface MenuItem {
  slug: string;
  label: string;
  shortLabel: string;
}

export const MENU_ITEMS: MenuItem[] = [
  { slug: 'top1-rate', label: '直近10場 1着率（まくり/差し/まくり差し）', shortLabel: '1着率' },
  { slug: 'place-counts', label: '直近5場 1着・2着数', shortLabel: '1・2着数' },
  { slug: 'start-timing', label: '直近10場 コース別スタートタイミング', shortLabel: 'スタートタイム' },
  { slug: 'exhibition-time', label: '直近10場 コース別持ちタイム', shortLabel: '持ちタイム' },
  { slug: 'series-rank', label: '今シリーズ 得点率順位', shortLabel: '得点率順位' },
  { slug: 'precheck-time', label: '今シリーズ 前検タイム', shortLabel: '前検タイム' },
];
