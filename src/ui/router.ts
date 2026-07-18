// ハッシュルーター。 #home / #drill/<category|mixed> / #stats を切り替える。
import type { Category } from '../types';
import { CATEGORIES } from '../types';
import { renderHome } from './screens/home';
import { renderDrill } from './screens/drill';
import { renderStats } from './screens/stats';

export type Route =
  | { screen: 'home' }
  | { screen: 'drill'; category: Category | 'mixed' }
  | { screen: 'stats' };

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [segment, param] = path.split('/');

  if (segment === 'drill' && typeof param === 'string') {
    if (param === 'mixed' || isCategory(param)) {
      return { screen: 'drill', category: param };
    }
  }

  if (segment === 'stats') {
    return { screen: 'stats' };
  }

  return { screen: 'home' };
}

export function initRouter(root: HTMLElement): void {
  const render = (): void => {
    const route = parseHash(window.location.hash);
    root.innerHTML = '';

    switch (route.screen) {
      case 'home':
        renderHome(root);
        break;
      case 'drill':
        renderDrill(root, route.category);
        break;
      case 'stats':
        renderStats(root);
        break;
    }

    window.scrollTo(0, 0);
  };

  window.addEventListener('hashchange', render);

  if (!window.location.hash) {
    // 初回アクセス時はホームへ。hashchange イベント経由で render() が走る。
    window.location.hash = '#home';
  } else {
    render();
  }
}
