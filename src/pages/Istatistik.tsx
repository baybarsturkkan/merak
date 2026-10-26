import { useApp } from '../app/context';
import { num, pct } from '../app/format';
import { DOMAIN_LABELS } from '../lib/schema';
import {
  calibration,
  confidentErrors,
  domainBreakdown,
  forecast,
  readingsPerWeek,
  reviewsPerDay,
  streak,
  trueRetention,
} from '../lib/stats';
import { addDays, shortDate } from '../lib/dates';
import { ColumnChart, HBars } from '../components/Charts';

const CONF_LABEL = { 1: 'Tahmin', 2: 'Sanırım', 3: 'Eminim' } as const;

export function Istatistik() {
  const { data, now } = useApp();
  if (!data) return null;

  const r30 = trueRetention(data.reviews, addDays(now, -30));
  const r7 = trueRetention(data.reviews, addDays(now, -7));
  const cal = calibration(data.reviews);
  const domains = domainBreakdown(data, now);
  const fc = forecast(data.states, now);
  const perDay = reviewsPerDay(data.reviews, now);
  const weeks = readingsPerWeek(data.readings, now);
  const errors = confidentErrors(data.reviews, 12);
  const mature = domains.reduce((a, d) => a + d.olgun, 0);
  const total = data.states.length;
  const sure = cal[2];

  return (
    <div className="page">
      <div className="page-head">
        <h1>İstatistik</h1>
        <p>“Biliyorum” hissi güvenilmez. Burada hissin değil, gerçek sonucun var.</p>
      </div>

      <div className="grid-4">
        <div className="tile">
          <span className="label">Gerçek hatırlama</span>
          <span className="value">{pct(r30.rate)}</span>
          <span className="note">
            30 gün · {num(r30.n)} deneme · hedef {pct(data.settings.retention)}
          </span>
        </div>
        <div className="tile">
          <span className="label">Son 7 gün</span>
          <span className="value">{pct(r7.rate)}</span>
          <span className="note">{num(r7.n)} deneme</span>
        </div>
        <div className="tile">
          <span className="label">Seri</span>
          <span className="value">{streak(data.reviews, now)}</span>
          <span className="note">gün üst üste</span>
        </div>
        <div className="tile">
          <span className="label">Olgun kart</span>
          <span className="value">{num(mature)}</span>
          <span className="note">/ {num(total)} · 21+ gün kalıcı</span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Ne kadar emin olduğun, ne kadar bildiğin</h2>
            <p>Cevaptan önce verdiğin güvene göre gerçekte doğru çıkma oranın</p>
          </div>
        </div>
        {cal.every((c) => c.n === 0) ? (
          <p className="muted">Tekrar kartlarında güvenini seçtikçe burası dolacak.</p>
        ) : (
          <>
            <ColumnChart
              label="Güven düzeyine göre doğruluk"
              height={170}
              max={1}
              format={(v) => pct(v)}
              tableHead={['Güven', 'Doğru']}
              data={cal.map((c) => ({
                label: CONF_LABEL[c.confidence],
                value: c.rate ?? 0,
                showValue: c.n > 0,
                dim: c.n === 0,
                tooltip: c.n ? `${CONF_LABEL[c.confidence]}: ${pct(c.rate)} doğru (${c.success}/${c.n})` : 'veri yok',
              }))}
            />
            {sure.n > 0 && (
              <p className="sub" style={{ marginTop: 10 }}>
                “Eminim” dediğinde {pct(sure.rate)} doğru çıkıyorsun
                {sure.rate !== null && sure.rate < 0.9
                  ? '. Emin olduğun hatalar en iyi düzelen hatalardır; aşağıda listeleniyorlar.'
                  : '.'}
              </p>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Alanlara göre hatırlama</h2>
            <p>Son 30 gün · dikey çizgi hedef {pct(data.settings.retention)}</p>
          </div>
        </div>
        {domains.every((d) => d.recall30.n === 0) ? (
          <p className="muted">Tekrar yaptıkça her alandaki gerçek hatırlama oranın burada görünecek.</p>
        ) : (
        <HBars
          target={data.settings.retention}
          rows={domains.map((d) => ({
            key: d.domain,
            label: DOMAIN_LABELS[d.domain],
            value: d.recall30.rate,
            valueText: d.recall30.n ? pct(d.recall30.rate) : '—',
            title: `${DOMAIN_LABELS[d.domain]}: ${d.recall30.n} deneme · ${d.total} kart (${d.yeni} yeni, ${d.olgun} olgun)${
              d.curiosity ? ` · merak ${d.curiosity.toFixed(1).replace('.', ',')}/3` : ''
            }`,
          }))}
        />
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Merak haritası</h2>
            <p>Yeni kartlarda verdiğin merak puanlarının ortalaması. Yeni kartlar bu sıraya göre ağırlıklı seçilir.</p>
          </div>
        </div>
        {domains.every((d) => d.curiosity === undefined) ? (
          <p className="muted">Yeni kartlarda merak puanı verdikçe burası dolacak.</p>
        ) : (
          <HBars
            emptyText="henüz yok"
            tone="spark"
            rows={[...domains]
              .sort((a, b) => (b.curiosity ?? 0) - (a.curiosity ?? 0))
              .map((d) => ({
                key: d.domain,
                label: DOMAIN_LABELS[d.domain],
                value: d.curiosity === undefined ? null : (d.curiosity - 1) / 2,
                valueText: d.curiosity === undefined ? '—' : `${d.curiosity.toFixed(1).replace('.', ',')}/3`,
              }))}
          />
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Önümüzdeki 14 gün</h2>
            <p>Günlere göre vadesi gelecek tekrar sayısı</p>
          </div>
        </div>
        <ColumnChart
          label="Önümüzdeki 14 günün tekrar sayısı"
          tableHead={['Gün', 'Kart']}
          data={fc.map((d, i) => ({
            label: i === 0 ? 'Bugün' : shortDate(d.date),
            value: d.count,
            showValue: false,
            tooltip: `${i === 0 ? 'Bugün (gecikmişler dahil)' : shortDate(d.date)}: ${d.count} kart`,
          }))}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Son 14 gün</h2>
            <p>Günlük tekrar sayısı</p>
          </div>
        </div>
        <ColumnChart
          label="Son 14 günün tekrar sayısı"
          tableHead={['Gün', 'Tekrar']}
          data={perDay.map((d, i) => ({
            label: i === perDay.length - 1 ? 'Bugün' : shortDate(d.date),
            value: d.count,
            showValue: i === perDay.length - 1 && d.count > 0,
            tooltip: `${shortDate(d.date)}: ${d.count} tekrar`,
          }))}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Haftalık okuma</h2>
            <p>Son 8 hafta · hedef haftada {data.settings.weeklyReadingGoal}</p>
          </div>
        </div>
        <ColumnChart
          label="Son 8 haftanın okuma sayısı"
          tableHead={['Hafta', 'Okuma']}
          data={weeks.map((w, i) => ({
            label: i === weeks.length - 1 ? 'Bu hafta' : shortDate(w.start),
            value: w.count,
            showValue: w.count > 0,
            tooltip: `${shortDate(w.start)} haftası: ${w.count} okuma`,
          }))}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Emin olup yanıldıkların</h2>
            <p>“Eminim” deyip bilemediğin kartlar. Bunlar düzeltildiğinde iyi hatırlanır.</p>
          </div>
        </div>
        {errors.length === 0 ? (
          <p className="muted">Henüz yok.</p>
        ) : (
          <div className="list">
            {errors.map((e) => {
              const c = data.byId.get(e.cardId)?.card;
              if (!c) return null;
              return (
                <div key={e.id} className="list-item">
                  <div className="item-title">{c.question}</div>
                  <div className="small" style={{ marginTop: 4 }}>
                    <span className="muted">Doğrusu: </span>
                    <strong>{c.answer}</strong>
                    {e.typed && <span className="muted"> · senin cevabın: {e.typed}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
