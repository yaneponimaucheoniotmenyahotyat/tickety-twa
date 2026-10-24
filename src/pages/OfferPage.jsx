import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import offerText from '../../shared/legal/offer.txt?raw';
import { OFFER } from '../../shared/legal/offer.js';
import Icon from '@/components/icons/Icon';
import TopBar, { BackLink } from '@/components/layout/TopBar';
import Button from '@/components/ui/Button';
import { acceptOffer } from '@/data/accountStore';
import { useServerAccount } from '@/hooks/useServerAccount';
import { haptic } from '@/lib/telegram';

// Текст оферты: заголовки разделов («1. ОПРЕДЕЛЕНИЯ…») крупнее, «* » — пункты списка
function OfferText() {
  const lines = offerText.split(/\r?\n/);
  return (
    <article className="space-y-2 text-subhead leading-relaxed">
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        if (i === 0) return <h1 key={i} className="text-title3">{t}</h1>;
        if (/^\d+\.\s+[А-ЯЁA-Z«"(][^а-яё]*$/.test(t)) return <h2 key={i} className="pt-3 text-headline">{t}</h2>;
        if (t.startsWith('* ')) {
          return (
            <p key={i} className="flex gap-2 pl-1">
              <span className="text-label-tertiary">•</span>
              <span>{t.slice(2)}</span>
            </p>
          );
        }
        return <p key={i}>{t}</p>;
      })}
    </article>
  );
}

export function OfferPage() {
  return (
    <>
      <TopBar title="Оферта" left={<BackLink />} />
      <main className="card mx-gutter mb-8 mt-3 p-4">
        <p className="mb-3 text-caption1 text-label-tertiary">Редакция от {OFFER.version.split('-').reverse().join('.')}</p>
        <OfferText />
      </main>
    </>
  );
}

const SUMMARY = [
  ['shield-check', 'Билеты — не дороже номинала, продавцы с подтверждённым номером'],
  ['lock', 'Деньги удерживаются до события, при проблеме с билетом — спор'],
  ['verified', 'Tickety — посредник: сделка заключается между продавцом и покупателем'],
];

// Экран согласия при первом входе (и после новой редакции). Читать оферту можно не закрывая его:
// на странице /legal/offer экран не показывается.
export function OfferGate() {
  const account = useServerAccount();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const offer = account.status === 'ok' ? account.user.offer : null;
  if (!offer || !offer.required || offer.accepted || pathname.startsWith('/legal')) return null;

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await acceptOffer(offer.version);
      haptic('success');
    } catch (e) {
      haptic('error');
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg pt-safe-t">
      <main className="flex flex-1 flex-col px-gutter pb-[calc(16px+var(--app-safe-bottom))] pt-8">
        <h1 className="text-title1">Добро пожаловать в Tickety</h1>
        <p className="mt-2 text-subhead text-label-secondary">Перепродажа билетов по честной цене. Перед началом — коротко о правилах.</p>

        <ul className="mt-6 space-y-4">
          {SUMMARY.map(([icon, text]) => (
            <li key={text} className="flex gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon name={icon} className="h-6 w-6" />
              </span>
              <span className="pt-2 text-subhead">{text}</span>
            </li>
          ))}
        </ul>

        <button type="button" onClick={() => navigate('/legal/offer')} className="mt-6 flex items-center text-body font-semibold text-brand">
          Прочитать публичную оферту полностью
          <Icon name="chevron-right" className="h-5 w-5" />
        </button>

        <div className="mt-auto pt-8">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-4">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--app-brand))]"
            />
            <span className="text-subhead">
              Я прочитал(а) и принимаю условия{' '}
              <button type="button" onClick={() => navigate('/legal/offer')} className="font-semibold text-brand">
                публичной оферты
              </button>
            </span>
          </label>
          {error && <p className="mt-2 text-center text-footnote text-danger">{error}</p>}
          <Button size="lg" block className="mt-3" disabled={!checked} loading={busy} onClick={accept}>
            Принять и продолжить
          </Button>
        </div>
      </main>
    </div>
  );
}
