// Данные витрины. События, зоны и демо-лоты — в shared/catalog.js (общие с сервером);
// здесь — то, что нужно только интерфейсу, и селекторы.
import { ZONES, events, offers } from '../../shared/catalog.js';
import { getListingOffers } from './listingsStore';
import { apiEnabled } from '@/lib/api';

// Демо-режим — сервер не подключён (GitHub Pages): выдуманные события, лоты и продавцы
// видны только здесь и всегда с плашкой «Демо». В бете (с сервером) — только настоящие объявления.
export const DEMO_MODE = !apiEnabled;

export { ZONES, events, offers };

export const CITIES = ['Москва', 'Санкт-Петербург'];

export const CATEGORIES = [
  { id: 'all', label: 'Все события' },
  { id: 'concert', label: 'Концерты' },
  { id: 'theatre', label: 'Театр' },
  { id: 'standup', label: 'Стендап' },
  { id: 'festival', label: 'Фестивали' },
];

export const PRICE_LIMIT = 20000; // правая граница слайдера «20 000+ ₽»

export const PAYMENT_METHODS = [
  { id: 'sbp', title: 'СБП', subtitle: 'Без комиссии • Мгновенно в любом банке', icon: 'sbp', badge: { label: 'Выгодно', tone: 'success' } },
  { id: 'tpay', title: 'T-Pay', subtitle: 'В один клик без ввода карты', icon: 'tpay' },
  { id: 'sberpay', title: 'SberPay', subtitle: 'СберБанк Онлайн и бонусы Спасибо', icon: 'sberpay' },
  { id: 'yandexpay', title: 'Yandex Pay', subtitle: 'С кешбэком баллами Плюса', icon: 'yandexpay', badge: { label: '+3% Плюс', tone: 'brand' } },
  { id: 'card', title: 'Банковская карта', subtitle: 'МИР, Visa, Mastercard', icon: 'card', mono: true },
];

export const SERVICE_FEE_PERCENT = 0;
export const RESERVATION_SECONDS = 15 * 60;

// ---- Селекторы ----

// Лоты витрины: в демо — выдуманные лоты + объявления с устройства; в бете — только объявления с сервера
const allOffers = () => (DEMO_MODE ? [...offers, ...getListingOffers()] : getListingOffers());

export const getEvent = (id) => events.find((e) => e.id === id);
export const getOffer = (id) => allOffers().find((o) => o.id === id);
export const getOffersByEvent = (eventId) => allOffers().filter((o) => o.eventId === eventId);

export const getMinPrice = (eventId, list = allOffers()) =>
  Math.min(...list.filter((o) => o.eventId === eventId).map((o) => o.price));

export const getVenues = () => [...new Set(events.map((e) => e.venue))];
