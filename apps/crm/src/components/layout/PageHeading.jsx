import React from 'react';
import { descriptions, labels } from '../../config/navigation.js';
import { useSession } from '../../hooks/useSession.js';
import { useRecords, useNavigation } from '../../hooks/useWorkspace.js';
import { DataExportMenu } from './DataExportMenu.jsx';

export function PageHeading() {
  const { user } = useSession();
  const { db } = useRecords();
  const { route } = useNavigation();
  const date = new Date().toLocaleDateString('en-AE', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Dubai',
  });
  const descriptionsByRoute = {
    'CRM insights': 'Understand your pipeline and make smarter decisions.',
    Performance: 'Know your numbers and set meaningful business targets.',
    'Client desk': 'A complete relationship profile and matching workspace.',
    'Date search': 'Find activity and transactions by any date range.',
    Guide: 'Master every tool in your real estate workspace.',
  };
  return (
    <div className="page-heading">
      <div className="heading-left">
        <div className="eyebrow">
          {route === 'Dashboard'
            ? 'WELCOME BACK'
            : route === 'Guide'
              ? 'WORKSPACE HANDBOOK'
              : 'YOUR BUSINESS, CONNECTED'}
        </div>
        <h1>{labels[route] || route}</h1>
        <p>{route === 'Dashboard' ? date : descriptions[route] || descriptionsByRoute[route]}</p>
      </div>
      <div className="heading-actions">
        {db.demo && (
          <span className="demo-pill">
            <span /> DEMO DATA
          </span>
        )}
        {user.permissions.exports && <DataExportMenu />}
      </div>
    </div>
  );
}
