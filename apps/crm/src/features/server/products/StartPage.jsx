import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation, useRecords } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { canOpenSection } from '../access.js';
import { selectConnectedDashboard } from '../dashboard/dashboardModel.js';
import { locate, productList, visibleProducts } from './productModel.js';
import { firstName, greetingKey, lastRoute, messageLinks, startCards } from './startModel.js';
import './start.css';

/** The CRM card's figures, from this session's scoped records only. */
function CrmFigures() {
  const { t } = useI18n();
  const { data } = useRecords();
  const summary = selectConnectedDashboard(data);
  const figures = [
    [summary.dueTasks.length, 'start.dueTasks'],
    [summary.openLeads.length, 'start.openLeads'],
    [summary.upcoming.length, 'start.viewings'],
  ];
  return (
    <div className="start-figures">
      {figures.map(([count, key]) => (
        <div key={key}>
          <strong>{count}</strong>
          <span>{t(key, { count })}</span>
        </div>
      ))}
    </div>
  );
}

export function StartPage() {
  const { t } = useI18n();
  const { user } = useSession();
  const { navigate } = useNavigation();
  const allowed = (route) => canOpenSection(user, route);
  const products = visibleProducts(user).map((product) => product.key);
  const cards = startCards
    .filter((card) => products.includes(card.key))
    .map((card) => ({ ...card, actions: card.actions.filter(allowed) }))
    .filter((card) => card.actions.length);
  const links = messageLinks.filter(allowed);
  const last = lastRoute();
  const lastPlace = last && last !== 'Start' && allowed(last) ? locate(user, last) : null;
  const name = firstName(user.name);
  const greeting = t(greetingKey(new Date().getHours()));
  return (
    <div className="start-page">
      <header className="start-hello">
        <h1>{name ? t('start.greeting', { greeting, name }) : greeting}</h1>
        <p>{t('start.intro')}</p>
      </header>
      <div className="start-cards">
        {cards.map(({ key, actions }) => (
          <article className="panel start-card" key={key} aria-labelledby={`start-${key}`}>
            <header>
              <span className="start-mark">
                <Icon name={productList.find((item) => item.key === key).icon} size={20} />
              </span>
              <h2 id={`start-${key}`}>{t(`products.${key}`)}</h2>
            </header>
            {key === 'crm' ? <CrmFigures /> : <p>{t(`start.about.${key}`)}</p>}
            <div className="start-actions">
              {actions.map((route, index) => (
                <Button
                  key={route}
                  variant={index ? 'light' : 'primary'}
                  onClick={() => navigate(route)}
                >
                  {index ? route : t('start.open', { product: t(`products.${key}`) })}
                </Button>
              ))}
            </div>
          </article>
        ))}
      </div>
      {links.length > 0 && (
        <nav className="panel start-messages" aria-label={t('products.messages')}>
          <strong>{t('products.messages')}</strong>
          {links.map((route) => (
            <button type="button" key={route} onClick={() => navigate(route)}>
              {t(`products.sections.${route === 'Inbox' ? 'inbox' : 'teamChat'}`)}
            </button>
          ))}
        </nav>
      )}
      {lastPlace && (
        <div className="panel start-continue">
          <span>{t('start.continue')}</span>
          <strong>
            {t(`products.${lastPlace.product}`)} · {last}
          </strong>
          <Button variant="light" onClick={() => navigate(last)}>
            {t('start.continueAction')}
          </Button>
        </div>
      )}
    </div>
  );
}
