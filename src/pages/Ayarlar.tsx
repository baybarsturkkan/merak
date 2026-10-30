import { useState } from 'react';
import { useApp } from '../app/context';
import { go } from '../app/router';
import { pct } from '../app/format';
import { SETTING_LIMITS, type Settings } from '../lib/schema';
import { DEFAULT_REPO, guessDeviceName, type Connection } from '../store/config';
import { GithubStore } from '../store/github';
import type { SyncState } from '../store/sync';
import { IconCheck, IconInfo, IconWarn } from '../components/Icons';

export function Ayarlar({ welcome = false }: { welcome?: boolean }) {
  const { engine } = useApp();
  return (
    <div className="page">
      <div className="page-head">
        <h1>{welcome ? 'Merak’a hoş geldin' : 'Ayarlar'}</h1>
        {welcome && (
          <p>
            Kartların ve ilerlemen özel GitHub depondan gelir. Bu cihazı bağlamak için bir kez token girmen yeterli; sonra
            telefon ve bilgisayar kendiliğinden senkron olur.
          </p>
        )}
      </div>
      <ConnectionPanel />
      {engine && !welcome && (
        <>
          <StudySettings />
          <SyncPanel />
        </>
      )}
      <InstallPanel />
      <AboutPanel />
    </div>
  );
}

function ConnectionPanel() {
  const { conn, setConn, engine } = useApp();
  const [form, setForm] = useState<Connection>({
    ...conn,
    repo: conn.repo || DEFAULT_REPO,
    device: conn.device || guessDeviceName(),
  });
  const [showToken, setShowToken] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (p: Partial<Connection>) => setForm((f) => ({ ...f, ...p }));
  const dev = import.meta.env.DEV;

  const connect = async () => {
    setResult(null);
    if (dev && form.useLocal) {
      setConn({ ...form });
      setResult({ ok: true, text: 'Yerel veri klasörü kullanılıyor.' });
      return;
    }
    if (!form.repo.includes('/') || !form.token.trim()) {
      setResult({ ok: false, text: 'Depo adı “kullanıcı/depo” biçiminde olmalı ve token boş olamaz.' });
      return;
    }
    setChecking(true);
    try {
      const store = new GithubStore({ repo: form.repo.trim(), token: form.token.trim() });
      const info = await store.check();
      if (!info.canWrite) throw new Error('Token bu depoya yazamıyor. İzinlerde “Contents: Read and write” seç.');
      const next = { ...form, repo: form.repo.trim(), token: form.token.trim(), branch: info.branch, useLocal: false };
      setConn(next);
      setResult({
        ok: true,
        text: `Bağlandı: ${next.repo} (${info.private ? 'özel' : 'herkese açık!'} depo, dal: ${info.branch}).`,
      });
      setTimeout(() => go('bugun'), 700);
    } catch (e) {
      setResult({ ok: false, text: (e as Error).message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="panel stack">
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <h2>Bağlantı</h2>
        {engine && <span className="chip chip-good">Bağlı</span>}
      </div>

      {dev && (
        <label className="checkbox">
          <input type="checkbox" checked={!!form.useLocal} onChange={(e) => set({ useLocal: e.target.checked })} />
          Yerel <code>veri/</code> klasörünü kullan (yalnızca geliştirme)
        </label>
      )}

      {!(dev && form.useLocal) && (
        <>
          <label className="field">
            Veri deposu
            <span className="hint">kullanıcı/depo</span>
            <input type="text" value={form.repo} onChange={(e) => set({ repo: e.target.value })} autoCapitalize="off" spellCheck={false} />
          </label>
          <label className="field">
            Token
            <span className="hint">Yalnızca bu tarayıcıda saklanır ve yalnızca api.github.com’a gönderilir.</span>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input
                type={showToken ? 'text' : 'password'}
                value={form.token}
                onChange={(e) => set({ token: e.target.value })}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="github_pat_…"
              />
              <button type="button" className="btn btn-sm" onClick={() => setShowToken((s) => !s)}>
                {showToken ? 'Gizle' : 'Göster'}
              </button>
            </div>
          </label>
        </>
      )}
      <label className="field">
        Bu cihazın adı
        <span className="hint">Kayıt dosyasının adında kullanılır (ör. telefon, laptop).</span>
        <input type="text" value={form.device} onChange={(e) => set({ device: e.target.value })} />
      </label>

      <div className="row">
        <button type="button" className="btn btn-primary" onClick={connect} disabled={checking}>
          {checking ? 'Kontrol ediliyor…' : engine ? 'Kaydet' : 'Bağlan'}
        </button>
      </div>

      {result && (
        <div className={`callout ${result.ok ? 'callout-good' : 'callout-warn'}`} role="status">
          {result.ok ? <IconCheck /> : <IconWarn />}
          <span>{result.text}</span>
        </div>
      )}

      {!(dev && form.useLocal) && (
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Token nasıl oluşturulur? (bir kez, 2 dakika)</summary>
          <ol className="steps" style={{ marginTop: 10 }}>
            <li>
              GitHub’da{' '}
              <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer noopener">
                yeni fine-grained token
              </a>{' '}
              sayfasını aç.
            </li>
            <li>
              <strong>Token name:</strong> “Merak”. <strong>Expiration:</strong> istediğin süre (dolunca burada yenilersin).
            </li>
            <li>
              <strong>Repository access:</strong> “Only select repositories” → <code>{form.repo || DEFAULT_REPO}</code>.
            </li>
            <li>
              <strong>Permissions → Repository permissions → Contents:</strong> “Read and write”. Başka izin gerekmez.
            </li>
            <li>“Generate token”a bas, çıkan <code>github_pat_…</code> değerini kopyalayıp yukarıya yapıştır.</li>
            <li>Telefonda da aynı token’ı kullanabilirsin. Cihaz kaybolursa token’ı GitHub’dan sil.</li>
          </ol>
        </details>
      )}
    </section>
  );
}

function StudySettings() {
  const { data, record } = useApp();
  if (!data) return null;
  const s = data.settings;
  /** Geçerli değeri kaydeder ve kutuda gösterilmesi gereken değeri döner. */
  const change = (key: keyof Settings, value: number): number => {
    const [lo, hi] = SETTING_LIMITS[key];
    if (!Number.isFinite(value)) return s[key];
    const v = Math.min(hi, Math.max(lo, value));
    if (v !== s[key]) record({ type: 'ayar', key, value: v });
    return v;
  };
  // Boş kutu 0 sayılmasın: Number('') === 0. Boş ya da sayı değilse eski değere dön.
  const changeInt = (key: 'newPerDay' | 'weeklyReadingGoal', input: HTMLInputElement) => {
    const raw = input.value.trim();
    input.value = String(change(key, raw === '' ? NaN : Math.round(Number(raw))));
  };
  return (
    <section className="panel stack">
      <h2>Çalışma</h2>
      <label className="field">
        Hedef hatırlama oranı
        <span className="hint">
          FSRS kartı, hatırlama olasılığın bu değerin altına düşerken getirir. %90 iyi bir denge; yükseltmek tekrar sayısını
          hızla artırır.
        </span>
        <select value={s.retention} onChange={(e) => change('retention', Number(e.target.value))}>
          {[0.85, 0.88, 0.9, 0.92, 0.95].map((v) => (
            <option key={v} value={v}>
              {pct(v)}
              {v === 0.9 ? ' (önerilen)' : ''}
            </option>
          ))}
        </select>
      </label>
      <div className="grid-2">
        <label className="field">
          Günlük yeni kart
          <input
            type="number"
            min={0}
            max={50}
            key={s.newPerDay}
            defaultValue={s.newPerDay}
            onBlur={(e) => changeInt('newPerDay', e.currentTarget)}
          />
        </label>
        <label className="field">
          Haftalık okuma hedefi
          <input
            type="number"
            min={0}
            max={30}
            key={s.weeklyReadingGoal}
            defaultValue={s.weeklyReadingGoal}
            onBlur={(e) => changeInt('weeklyReadingGoal', e.currentTarget)}
          />
        </label>
      </div>
      <p className="muted small">Ayarlar tüm cihazlarında geçerlidir.</p>
    </section>
  );
}

const STATE_LABEL: Record<SyncState, string> = {
  hazir: 'Hazır',
  senkron: 'Senkronize ediliyor…',
  cevrimdisi: 'Çevrimdışı',
  hata: 'Hata',
};

function SyncPanel() {
  const { status, engine, sync, conn } = useApp();
  if (!engine) return null;
  return (
    <section className="panel stack">
      <h2>Senkron</h2>
      <dl className="kv">
        <dt>Kaynak</dt>
        <dd>{engine && conn.useLocal && import.meta.env.DEV ? 'yerel veri/ klasörü' : conn.repo}</dd>
        <dt>Cihaz</dt>
        <dd>
          <code>{engine.device}</code>
        </dd>
        <dt>Durum</dt>
        <dd>{status.message ?? STATE_LABEL[status.state]}</dd>
        <dt>Bekleyen</dt>
        <dd>{status.pending} olay</dd>
        <dt>Son senkron</dt>
        <dd>{status.lastSync ? new Date(status.lastSync).toLocaleString('tr-TR') : '—'}</dd>
      </dl>
      <div className="row">
        <button type="button" className="btn btn-sm" onClick={() => void sync()}>
          Şimdi senkronize et
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            await engine.clearCache();
            await sync();
          }}
        >
          Önbelleği silip yeniden indir
        </button>
      </div>
    </section>
  );
}

function InstallPanel() {
  return (
    <section className="panel stack">
      <h2>Telefona ekle</h2>
      <ul className="plain">
        <li>
          <strong>iPhone (Safari):</strong> Paylaş düğmesi → “Ana Ekrana Ekle”.
        </li>
        <li>
          <strong>Android (Chrome):</strong> ⋮ menüsü → “Uygulamayı yükle” ya da “Ana ekrana ekle”.
        </li>
      </ul>
      <p className="muted small">Uygulama çevrimdışı da açılır; yaptığın tekrarlar bağlantı gelince gönderilir.</p>
    </section>
  );
}

function AboutPanel() {
  return (
    <section className="panel stack">
      <h2>Hakkında</h2>
      <div className="callout">
        <IconInfo />
        <span>
          Merak, “Genel Kültürü Artırmak: Bilimsel Bulgular” belgesindeki bulgulara dayanır: hatırlama pratiği, aralıklı tekrar
          (FSRS), ön test, aşırı düzeltme, merak, karma çalışma ve okuma günlüğü. Kartlar özel bir GitHub deposunda düz
          dosyalar olarak durur; hiçbir veri başka bir sunucuya gitmez.
        </span>
      </div>
    </section>
  );
}
