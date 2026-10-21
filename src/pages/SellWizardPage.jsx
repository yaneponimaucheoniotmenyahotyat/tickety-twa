import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '@/components/icons/Icon';
import TopBar, { BackLink } from '@/components/layout/TopBar';
import EventPicker from '@/components/sell/EventPicker';
import PriceStep, { MIN_PRICE } from '@/components/sell/PriceStep';
import ReviewStep from '@/components/sell/ReviewStep';
import TicketUploadStep from '@/components/sell/TicketUploadStep';
import WizardProgress from '@/components/sell/WizardProgress';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import { addListing, publishListing } from '@/data/listingsStore';
import { getEvent, getOffersByEvent } from '@/data/mockData';
import { apiEnabled, uploadTicket } from '@/lib/api';
import { analyzeTicketLocally, listingTitle, runCheckAnimation, validateFile } from '@/lib/ticketCheck';
import { getUser, haptic, setClosingConfirmation } from '@/lib/telegram';

const IDLE_CHECK = { status: 'idle', step: 0, error: null };

// Мастер «Выставить билет». Шаг — в ?step=N: каждый переход кладёт запись в историю,
// поэтому нативная «Назад» Telegram возвращает на предыдущий шаг, а состояние не теряется.
export default function SellWizardPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const step = Math.min(4, Math.max(1, Number(params.get('step')) || 1));

  const [eventId, setEventId] = useState(null);
  const [file, setFile] = useState(null);
  const [check, setCheck] = useState(IDLE_CHECK);
  const [details, setDetails] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [createdId, setCreatedId] = useState(null);
  // Режим сервера: id проверки билета — объявление создаётся по нему, номинал знает сервер
  const [checkId, setCheckId] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);

  const event = eventId ? getEvent(eventId) : null;
  const n = Number(price) || 0;
  const priceValid = details && n >= MIN_PRICE && n <= details.nominal;
  // Дальше какого шага можно пройти с текущими данными (защита от прямого перехода по ?step=4)
  const maxStep = !event ? 1 : check.status !== 'done' ? 2 : !priceValid ? 3 : 4;

  useEffect(() => {
    if (step > maxStep && !createdId) setParams({ step: String(maxStep) }, { replace: true });
  }, [step, maxStep, createdId, setParams]);

  // Есть несохранённый черновик — Telegram переспросит перед закрытием
  useEffect(() => {
    setClosingConfirmation(Boolean(eventId) && !createdId);
    return () => setClosingConfirmation(false);
  }, [eventId, createdId]);

  const market = useMemo(() => {
    if (!event || !details) return { count: 0, min: 0 };
    const same = getOffersByEvent(event.id).filter((o) => o.zone === details.zone && !o.own);
    return { count: same.length, min: same.length ? Math.min(...same.map((o) => o.price)) : 0 };
  }, [event, details]);

  const go = (next) => {
    haptic('light');
    setParams({ step: String(next) });
  };

  const selectEvent = (id) => {
    if (id !== eventId) {
      setEventId(id);
      setFile(null);
      setCheck(IDLE_CHECK);
      setDetails(null);
      setPrice('');
    }
    go(2);
  };

  const handleFile = async (f) => {
    const error = validateFile(f);
    setFile(f);
    setDetails(null);
    setCheckId(null);
    setPrice('');
    if (error) {
      haptic('error');
      setCheck({ status: 'error', step: 0, error });
      return;
    }
    setCheck({ status: 'running', step: 0, error: null });

    // С сервером: файл уходит на проверку (формат по содержимому, дубли, номинал).
    // Без сервера: локальная «распознавалка». Анимация чек-листа идёт параллельно.
    const work = apiEnabled
      ? uploadTicket(f, eventId).then((r) => {
          setCheckId(r.checkId);
          return r.details;
        })
      : Promise.resolve(analyzeTicketLocally(f, getOffersByEvent(eventId).filter((o) => !o.own && !o.status)));

    let result;
    try {
      result = await runCheckAnimation(work, (i) => setCheck((c) => ({ ...c, step: i })));
    } catch (e) {
      haptic('error');
      setCheck({ status: 'error', step: 0, error: e.message });
      return;
    }
    haptic('success');
    setDetails(result);
    setPrice(String(result.nominal));
    setCheck({ status: 'done', step: 4, error: null });
  };

  const publish = async () => {
    if (apiEnabled) {
      setPublishing(true);
      setPublishError(null);
      try {
        const listing = await publishListing({
          checkId,
          price: n,
          quantity,
          ...(details.seated ? { sector: details.sector, row: details.row, seat: details.seat } : {}),
        });
        haptic('success');
        setCreatedId(listing.id);
      } catch (e) {
        haptic('error');
        setPublishError(e.message);
      } finally {
        setPublishing(false);
      }
      return;
    }

    const user = getUser();
    const listing = {
      id: `l-${Date.now().toString(36)}`,
      eventId,
      zone: details.zone,
      title: listingTitle(details),
      details: `${details.fileKind} • проверен Tickety AI`,
      delivery: details.fileKind === 'PDF' ? 'PDF' : 'Фото → PDF',
      eTicket: true,
      nominal: details.nominal,
      price: n,
      quantity,
      verified: true,
      seller: { name: user?.first_name ? `${user.first_name} (вы)` : 'Вы', rating: 5.0, sales: 0 },
      own: true,
      status: 'active',
      createdAt: Date.now(),
      fileName: file.name,
    };
    addListing(listing);
    haptic('success');
    setCreatedId(listing.id);
  };

  const footer = {
    1: null, // событие выбирается тапом по строке
    2: (
      <Button size="lg" block iconRight="arrow-right" disabled={check.status !== 'done'} onClick={() => go(3)}>
        {check.status === 'running' ? 'Проверяем билет…' : 'Далее: цена'}
      </Button>
    ),
    3: (
      <Button size="lg" block iconRight="arrow-right" disabled={!priceValid} onClick={() => go(4)}>
        Далее: проверка
      </Button>
    ),
    4: (
      <>
        {publishError && <p className="mb-2 text-center text-footnote text-danger">{publishError}</p>}
        <Button size="lg" block icon="bolt" disabled={!confirmed} loading={publishing} onClick={publish}>
          {publishing ? 'Публикуем…' : 'Выставить на продажу'}
        </Button>
      </>
    ),
  }[step];

  return (
    <>
      <TopBar title="Новое объявление" left={<BackLink label={step > 1 ? 'Назад' : 'Продажи'} />} />

      <main className={`space-y-4 px-gutter pt-3 ${footer ? 'pb-[calc(110px+var(--app-safe-bottom))]' : 'pb-8'}`}>
        <WizardProgress step={step} />

        {step === 1 && <EventPicker selectedId={eventId} onSelect={selectEvent} />}
        {step === 2 && event && (
          <TicketUploadStep
            file={file}
            check={check}
            details={details}
            quantity={quantity}
            onFile={handleFile}
            onDetails={(patch) => setDetails((d) => ({ ...d, ...patch }))}
            onQuantity={setQuantity}
          />
        )}
        {step === 3 && details && (
          <PriceStep nominal={details.nominal} price={price} onPrice={setPrice} quantity={quantity} market={market} />
        )}
        {step === 4 && priceValid && (
          <ReviewStep
            event={event}
            title={listingTitle(details)}
            details={details}
            quantity={quantity}
            price={n}
            confirmed={confirmed}
            onConfirm={setConfirmed}
          />
        )}
      </main>

      {footer && (
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-separator/60 bg-bg/90 px-gutter pb-[calc(12px+var(--app-safe-bottom))] pt-3 backdrop-blur-xl">
          {footer}
        </footer>
      )}

      <BottomSheet
        open={Boolean(createdId)}
        onClose={() => navigate('/sell', { replace: true })}
        footer={
          <div className="space-y-2">
            <Button size="lg" block onClick={() => navigate(`/event/${eventId}`, { replace: true })}>
              Посмотреть на странице события
            </Button>
            <Button size="lg" block variant="plain" onClick={() => navigate('/sell', { replace: true })}>
              Мои объявления
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center pb-2 pt-4 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-success-soft">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-success text-white">
              <Icon name="check" className="h-12 w-12" />
            </span>
          </span>
          <h2 className="mt-4 text-title2">Билет в продаже</h2>
          <p className="mt-1 text-subhead text-label-secondary">
            Покупатели увидят его на странице «{event?.title}». Мы напишем в Telegram, как только билет купят.
          </p>
        </div>
      </BottomSheet>
    </>
  );
}
