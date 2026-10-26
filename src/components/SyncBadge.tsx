import { useApp } from '../app/context';
import { go } from '../app/router';

const LABEL = {
  hazir: 'Senkron',
  senkron: 'Senkronize ediliyor',
  cevrimdisi: 'Çevrimdışı',
  hata: 'Senkron hatası',
} as const;

export function SyncBadge() {
  const { status, engine, conn } = useApp();
  if (!engine) return null;
  const local = engine && conn.useLocal && import.meta.env.DEV;
  let text: string = LABEL[status.state];
  if (status.state === 'hazir' && status.pending > 0) text = `${status.pending} bekleyen`;
  if (local && status.state === 'hazir') text = 'Yerel veri';
  const title = status.message ?? (status.lastSync ? `Son senkron: ${new Date(status.lastSync).toLocaleTimeString('tr-TR')}` : '');
  return (
    <button
      type="button"
      className="sync"
      data-state={status.state}
      title={title}
      onClick={() => (status.state === 'hata' ? go('ayarlar') : void engine.sync())}
    >
      <span className="dot" aria-hidden />
      {text}
    </button>
  );
}
