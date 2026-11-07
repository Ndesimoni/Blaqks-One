import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { StateSkeleton, StateView } from '../../components/ui/StateView.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useNavigation } from '../../hooks/useWorkspace.js';
import { useI18n } from '../../i18n/useI18n.js';
import { productEntry, productList } from './products/productModel.js';

/** Where "Go to" leads: the first page this person may open in the route's product, else Start. */
function wayOut(user, route) {
  const product = productList.find((item) =>
    item.sections.some((section) => section.routes.includes(route)),
  );
  return (product && productEntry(user, product.key)) || 'Start';
}

/**
 * A page the person may not open (approved mockup): who decides, and a way to a page they can
 * open. An address that leads nowhere says the workspace is ready and offers the start page.
 */
export function NoAccessState({ route }) {
  const { t } = useI18n();
  const { user } = useSession();
  const { navigate } = useNavigation();
  const missing = route === 'Page not found';
  const target = missing ? 'Start' : wayOut(user, route);
  return (
    <StateView
      icon={missing ? 'home' : 'lock'}
      title={missing ? t('frame.readyTitle') : t('frame.noAccessTitle', { section: route })}
      detail={missing ? t('frame.readyBody') : t('frame.noAccessBody', { section: route })}
    >
      <Button onClick={() => navigate(target)}>
        {target === 'Start' ? t('frame.goStart') : t('frame.goTo', { section: target })}
      </Button>
    </StateView>
  );
}

/** Records still loading: the mockup's skeleton rows, named for screen readers. */
export function RecordsLoading({ route }) {
  const { t } = useI18n();
  return <StateSkeleton label={t('frame.loading', { section: route })} />;
}

/** Records that failed to load: saved work is safe, the reason, and Try again. */
export function RecordsLoadError({ route, error, retry }) {
  const { t } = useI18n();
  return (
    <StateView
      tone="error"
      role="alert"
      icon="close"
      title={t('frame.loadErrorTitle', { section: route })}
      detail={`${t('frame.loadErrorBody')} ${error}`}
    >
      <Button onClick={retry}>{t('frame.tryAgain')}</Button>
    </StateView>
  );
}
