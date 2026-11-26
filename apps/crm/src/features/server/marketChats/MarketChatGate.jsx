import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/** Why there are no chats to show (not joined, unavailable or none yet), with the way on. */
export function MarketChatGate({ title, detail, onOpen }) {
  const { t } = useI18n();
  return (
    <section className="panel market-chat-gate">
      <Empty
        icon="layers"
        title={title}
        detail={detail}
        action={
          onOpen && (
            <Button onClick={() => onOpen('Marketplace')}>
              {t('marketChats.openMarketplace')}
            </Button>
          )
        }
      />
    </section>
  );
}
