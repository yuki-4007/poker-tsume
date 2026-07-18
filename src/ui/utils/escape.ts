// HTML エスケープユーティリティ。
// data / learning モジュール由来の文字列を innerHTML に埋め込む前に必ず通す。
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
