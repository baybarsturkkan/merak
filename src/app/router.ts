import { useEffect, useState } from 'react';

export const ROUTES = ['bugun', 'calis', 'okuma', 'rehber', 'istatistik', 'kartlar', 'ayarlar'] as const;
export type Route = (typeof ROUTES)[number];

function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(h) ? (h as Route) : 'bugun';
}

export function go(r: Route): void {
  window.location.hash = `/${r}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
