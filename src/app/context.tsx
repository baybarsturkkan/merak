import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { EventInput, Guide } from '../lib/schema';
import { derive, type Derived } from '../lib/state';
import {
  browserKV,
  createDataStore,
  deviceSlug,
  loadConnection,
  saveConnection,
  type Connection,
} from '../store/config';
import { SyncEngine, type Snapshot, type SyncStatus } from '../store/sync';

interface AppState {
  conn: Connection;
  setConn: (c: Connection) => void;
  engine: SyncEngine | null;
  /** Önbellek yüklendi mi */
  ready: boolean;
  /** İlk indirme sürüyor (önbellek boş) */
  loading: boolean;
  status: SyncStatus;
  data: Derived | null;
  problems: string[];
  /** rehber/*.json: alanlara göre kaynak rehberleri */
  guides: Guide[];
  record: (e: EventInput) => void;
  sync: () => Promise<void>;
  now: Date;
}

const Ctx = createContext<AppState | null>(null);

const EMPTY: Snapshot = { cards: [], events: [], guides: [], problems: [] };
const IDLE: SyncStatus = { state: 'hazir', pending: 0 };
const noSubscribe = () => () => {};
const PUSH_DELAY_MS = 15_000;

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    const onVis = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs]);
  return now;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [conn, setConnState] = useState<Connection>(loadConnection);
  const engine = useMemo(() => {
    const store = createDataStore(conn);
    return store ? new SyncEngine(store, deviceSlug(conn), browserKV) : null;
  }, [conn]);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!engine) return;
    let alive = true;
    setReady(false);
    void engine.init().then(() => {
      if (!alive) return;
      setReady(true);
      void engine.sync();
    });
    return () => {
      alive = false;
    };
  }, [engine]);

  // Uygulama öne gelince çek, arka plana geçince gönder
  useEffect(() => {
    if (!engine) return;
    const onVis = () => void (document.visibilityState === 'visible' ? engine.sync() : engine.push());
    const onOnline = () => void engine.sync();
    const onPageHide = () => void engine.push(); // iOS'ta visibilitychange'den daha güvenilir
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void engine.sync();
    }, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [engine]);

  const subscribe = useCallback((fn: () => void) => (engine ? engine.subscribe(fn) : noSubscribe()), [engine]);
  const snapshot = useSyncExternalStore(subscribe, () => (engine ? engine.snapshot() : EMPTY));
  const status = useSyncExternalStore(subscribe, () => engine?.status ?? IDLE);

  const data = useMemo(() => (ready ? derive(snapshot.cards, snapshot.events) : null), [snapshot, ready]);

  // Kayıtlar biriktirilip gönderilir: 5 olunca hemen, değilse son kayıttan 15 sn sonra
  const pushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(pushTimer.current), [engine]);
  const record = useCallback(
    (e: EventInput) => {
      if (!engine) return;
      engine.record(e);
      clearTimeout(pushTimer.current);
      if (engine.status.pending >= 5) void engine.push();
      else pushTimer.current = setTimeout(() => void engine.push(), PUSH_DELAY_MS);
    },
    [engine],
  );

  const setConn = useCallback((c: Connection) => {
    saveConnection(c);
    setConnState(c);
  }, []);

  const now = useNow(60_000);

  const value: AppState = {
    conn,
    setConn,
    engine,
    ready,
    loading: ready && snapshot.cards.length === 0 && status.state === 'senkron',
    status,
    data,
    problems: snapshot.problems,
    guides: snapshot.guides,
    record,
    sync: () => engine?.sync() ?? Promise.resolve(),
    now,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider eksik');
  return v;
}
