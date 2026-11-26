import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation, useRecords, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useRecordAccess } from '../../records/useRecordAccess.js';
import { canOpenSection } from '../access.js';
import { GetStartedChecklist } from '../dashboard/GetStartedChecklist.jsx';
import { selectConnectedDashboard } from '../dashboard/dashboardModel.js';
import { createItems } from './createModel.js';
import { locate, visibleProducts } from './productModel.js';
import { StartCard, StartFigures } from './StartCard.jsx';
import { firstName, greetingKey, lastRoute, messageLinks, startCards } from './startModel.js';
import { StartTour } from './StartTour.jsx';
import { useStartFigures } from './useStartFigures.js';
import { useStartRequest } from './useStartRequest.js';
import './start.css';

const MESSAGE_SECTIONS = {
  Inbox: 'inbox',
  'Team chat': 'teamChat',
  'Marketplace chats': 'marketChats',
};

/**
 * The start page as the approved mockup draws it (design queue item 35): the Get started
 * checklist for an Admin, the greeting with the date and the follow-ups due, one card per
 * product with its figures and quick action, the Messages strip and Continue.
 */
export function StartPage() {
  const { t, format } = useI18n();
  const { user, company } = useSession();
  const { owner } = useWorkspaceScope();
  const { navigate, route } = useNavigation();
  const { data } = useRecords();
  const editor = useWorkspaceActions();
  const can = useRecordAccess();
  const figures = useStartFigures();
  const allowed = (name) => canOpenSection(user, name);
  const lead = createItems('crm', can, route).find((item) => item.key === 'lead');
  const doable = (action) =>
    action === 'add-lead' ? Boolean(lead) && !editor.readOnly : allowed(action);
  const run = (action) =>
    action === 'add-lead' ? editor.add(lead.module, lead.defaults()) : navigate(action);
  const products = visibleProducts(user).map((product) => product.key);
  const cards = startCards
    .filter((card) => products.includes(card.key))
    .map((card) => ({ ...card, actions: card.actions.filter(doable) }))
    .filter((card) => card.actions.length);
  const links = messageLinks.filter(allowed);
  const last = lastRoute();
  const lastPlace = last && last !== 'Start' && allowed(last) ? locate(user, last) : null;
  const name = firstName(user.name);
  const greeting = t(greetingKey(new Date().getHours()));
  const summary = selectConnectedDashboard(data);
  const due = summary.dueTasks.length;
  const today = format.date(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
  // The tour runs from Take the tour, and once on arrival from sign-up (`?start=tour`).
  const [tour, setTour] = useState(0);
  const askedTour = useStartRequest('tour');
  useEffect(() => {
    if (askedTour) setTour((value) => value + 1);
  }, [askedTour]);
  return (
    <div className="start-page">
      {user.roleId === 'admin' && (
        <GetStartedChecklist workspaceId={owner.id} data={data} company={company} />
      )}
      <header className="start-hello">
        <h1>{name ? t('start.greeting', { greeting, name }) : greeting}</h1>
        <p>
          {products.includes('crm') ? t('start.today', { date: today, count: due }) : today}
          {' · '}
          <button type="button" className="start-tour-link" onClick={() => setTour(tour + 1)}>
            {t('start.tour.take')}
          </button>
        </p>
      </header>
      <StartTour run={tour} />
      <div className="start-cards">
        {cards.map((card) => (
          <StartCard
            key={card.key}
            card={card}
            figures={figures}
            crmFigures={
              <StartFigures
                items={[
                  [due, 'start.dueTasks'],
                  [summary.openLeads.length, 'start.openLeads'],
                  [summary.upcoming.length, 'start.viewings'],
                ]}
              />
            }
            onAction={run}
          />
        ))}
      </div>
      {links.length > 0 && (
        <nav className="panel start-messages" aria-label={t('products.messages')}>
          <strong>{t('products.messages')}</strong>
          {links.map((route) => (
            <button type="button" key={route} onClick={() => navigate(route)}>
              {t(`products.sections.${MESSAGE_SECTIONS[route]}`)}
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
