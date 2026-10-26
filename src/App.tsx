import { AppProvider, useApp } from './app/context';
import { useRoute, type Route } from './app/router';
import { Bugun } from './pages/Bugun';
import { Calisma } from './pages/Calisma';
import { Okuma } from './pages/Okuma';
import { Istatistik } from './pages/Istatistik';
import { Kartlar } from './pages/Kartlar';
import { Ayarlar } from './pages/Ayarlar';
import { SyncBadge } from './components/SyncBadge';
import { IconBook, IconCards, IconChart, IconGear, IconHome, Logo } from './components/Icons';

const NAV: Array<{ route: Route; label: string; Icon: typeof IconHome }> = [
  { route: 'bugun', label: 'Bugün', Icon: IconHome },
  { route: 'okuma', label: 'Okuma', Icon: IconBook },
  { route: 'istatistik', label: 'İstatistik', Icon: IconChart },
  { route: 'kartlar', label: 'Kartlar', Icon: IconCards },
  { route: 'ayarlar', label: 'Ayarlar', Icon: IconGear },
];

function Shell() {
  const route = useRoute();
  const { engine } = useApp();

  if (!engine) {
    return (
      <div className="shell">
        <header className="topbar">
          <span className="brand">
            <Logo /> Merak
          </span>
        </header>
        <Ayarlar welcome />
      </div>
    );
  }

  if (route === 'calis') return <Calisma />;

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#/bugun">
          <Logo /> Merak
        </a>
        {/* Telefonda altta sabit, geniş ekranda başlık satırında */}
        <nav className="nav" aria-label="Bölümler">
          <div className="nav-inner">
            {NAV.map(({ route: r, label, Icon }) => (
              <a key={r} href={`#/${r}`} aria-current={route === r ? 'page' : undefined}>
                <Icon />
                {label}
              </a>
            ))}
          </div>
        </nav>
        <SyncBadge />
      </header>
      <main>
        {route === 'bugun' && <Bugun />}
        {route === 'okuma' && <Okuma />}
        {route === 'istatistik' && <Istatistik />}
        {route === 'kartlar' && <Kartlar />}
        {route === 'ayarlar' && <Ayarlar />}
      </main>
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
