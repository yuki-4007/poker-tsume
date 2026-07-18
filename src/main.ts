// エントリポイント。スタイル読み込み・ルーター起動・Service Worker登録を行う。
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/screens/home.css';
import './styles/screens/drill.css';
import './styles/screens/stats.css';
import { initRouter } from './ui/router';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('#app 要素が見つかりません。index.html を確認してください。');
}

initRouter(app);

// 本番ビルド時のみ Service Worker を登録する（開発中のキャッシュ事故を防ぐ）。
// ハッシュルーティングのため location.pathname は常に一定 → 相対パス登録で安全にスコープが決まる。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((error: unknown) => {
        console.error('Service Workerの登録に失敗しました', error);
      });
  });
}
