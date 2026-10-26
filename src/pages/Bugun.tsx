import { useApp } from '../app/context';
import { go } from '../app/router';
import { pct, num } from '../app/format';
import { introducedToday } from '../lib/state';
import { pendingReadings, readingsThisWeek, streak, trueRetention } from '../lib/stats';
import { addDays, formatInterval } from '../lib/dates';
import { IconBook, IconCompass, IconInfo, IconWarn } from '../components/Icons';
import { suggestItem } from '../lib/guide';
import { GUIDE_AREA_LABELS } from '../lib/schema';
import { rememberArea } from './Rehber';

export function Bugun() {
  const { data, now, loading, problems, guides } = useApp();
  if (!data || loading) {
    return (
      <div className="page">
        <div className="panel">
          <p className="muted">Kartlar yükleniyor…</p>
        </div>
      </div>
    );
  }

  const active = data.states.filter((s) => !s.suspended);
  const due = active.filter((s) => !s.isNew && s.fsrs.due <= now).length;
  const newLeft = Math.max(0, data.settings.newPerDay - introducedToday(data.reviews, now));
  const newAvailable = Math.min(newLeft, active.filter((s) => s.isNew).length);
  const minutes = Math.max(1, Math.round((due * 12 + newAvailable * 40) / 60));
  const next = active
    .filter((s) => !s.isNew && s.fsrs.due > now)
    .sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime())[0];

  const retention = trueRetention(data.reviews, addDays(now, -30));
  const days = streak(data.reviews, now);
  const weekReads = readingsThisWeek(data.readings, now);
  const goal = data.settings.weeklyReadingGoal;
  const pending = pendingReadings(data.readings);
  const flagged = data.states.filter((s) => s.flag);
  const learned = data.states.filter((s) => !s.isNew).length;
  const suggestion = suggestItem(guides, data.readings, data.domainCuriosity);

  return (
    <div className="page">
      <div className="panel stack hero" style={{ gap: 18 }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">{now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1>Bugün</h1>
          <p className="sub">
            {due + newAvailable > 0
              ? `Yaklaşık ${minutes} dakika`
              : next
                ? `Sıradaki tekrar ${formatInterval(next.fsrs.due.getTime() - now.getTime())} sonra`
                : 'Bugünlük bitti'}
          </p>
        </div>
        <div className="grid-2">
          <div className="tile tile-flat">
            <span className="label">Tekrar</span>
            <span className="value">{num(due)}</span>
            <span className="note">vadesi gelen kart</span>
          </div>
          <div className="tile tile-flat">
            <span className="label">Yeni</span>
            <span className="value">{num(newAvailable)}</span>
            <span className="note">önce tahmin edeceğin kart</span>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-big"
          disabled={due + newAvailable === 0}
          onClick={() => go('calis')}
        >
          {due + newAvailable > 0 ? 'Başla' : 'Bugünlük bitti'}
        </button>
      </div>

      <div className="grid-4">
        <div className="tile">
          <span className="label">Gerçek hatırlama</span>
          <span className="value">{pct(retention.rate)}</span>
          <span className="note">son 30 gün · hedef {pct(data.settings.retention)}</span>
        </div>
        <div className="tile">
          <span className="label">Seri</span>
          <span className="value">{days}</span>
          <span className="note">gün üst üste</span>
        </div>
        <div className="tile">
          <span className="label">Öğrenilen</span>
          <span className="value">{num(learned)}</span>
          <span className="note">/ {num(data.states.length)} kart</span>
        </div>
        <div className="tile">
          <span className="label">Bu hafta okuma</span>
          <span className="value">
            {weekReads}
            <span className="muted" style={{ fontSize: '1rem', fontWeight: 500 }}>
              {' '}
              / {goal}
            </span>
          </span>
          <div className="meter" style={{ marginTop: 6 }} aria-hidden>
            <span style={{ width: `${goal ? Math.min(100, (weekReads / goal) * 100) : 0}%` }} />
          </div>
        </div>
      </div>

      <div className="panel stack">
        <div className="spread">
          <div>
            <h2>Okuma</h2>
            <p className="sub">Genel kültürü en çok artıran, değiştirebileceğin etken: ne kadar okuduğun.</p>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => go('okuma')}>
            <IconBook width={16} height={16} /> Ekle
          </button>
        </div>
        {pending.length > 0 ? (
          <div className="callout callout-accent">
            <IconInfo />
            <span>
              {pending.length} okuma kart bekliyor. Bilgisayarda Claude Code’a <code>/okuma</code> yaz; her birinden 2–3 kart
              çıkarılsın.
            </span>
          </div>
        ) : (
          <p className="muted small">
            Okuduğun bir makaleyi ya da kitabı ekle; Claude Code ondan kart çıkarsın.
          </p>
        )}
        {suggestion && (
          <a className="suggest" href="#/rehber" onClick={() => rememberArea(suggestion.guide.area)}>
            <IconCompass />
            <span>
              <span className="muted small">Ne okusam? Rehberden, {GUIDE_AREA_LABELS[suggestion.guide.area]}:</span>
              <br />
              <strong>{suggestion.item.title}</strong>
              {suggestion.item.author && <span className="muted"> · {suggestion.item.author}</span>}
            </span>
          </a>
        )}
      </div>

      {flagged.length > 0 && (
        <div className="callout callout-warn">
          <IconWarn />
          <span>
            {flagged.length} kart hatalı işaretli. Claude Code’da <code>/kart-duzelt</code> ile düzeltilebilir.
          </span>
        </div>
      )}

      {problems.length > 0 && (
        <details className="callout callout-warn">
          <summary>{problems.length} veri satırı okunamadı</summary>
          <ul className="plain">
            {problems.slice(0, 10).map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </details>
      )}

      <details className="panel">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Bu uygulama neden böyle çalışıyor?</summary>
        <ul className="plain" style={{ marginTop: 12 }}>
          <li>
            <strong>Kendini test etmek</strong> yeniden okumaktan çok daha etkili. Bu yüzden cevap görünmeden önce yazıyor ya
            da aklından söylüyorsun.
          </li>
          <li>
            <strong>Aralıklı tekrar (FSRS)</strong> kartları unutmak üzereyken getirir. Hedef %90 hatırlama; bildiğin kartlar
            silinmez, seyrekleşir.
          </li>
          <li>
            <strong>Önce tahmin etmek</strong>, yanılsan bile, yeni bilgiyi daha iyi hatırlatır.
          </li>
          <li>
            <strong>Emin olduğun hatalar</strong> düzeltildiğinde en iyi hatırlananlardır; bu yüzden cevaptan önce güvenini
            soruyoruz.
          </li>
          <li>
            <strong>Merak</strong> hafızayı güçlendirir. Merak ettiğin alanlardan daha çok yeni kart gelir, ama genişlik için
            diğer alanlar da karışır.
          </li>
          <li>
            <strong>“Biliyorum” hissi güvenilmez.</strong> İstatistik ekranı hissini değil, gerçek sonucunu gösterir.
          </li>
        </ul>
      </details>
    </div>
  );
}
