import { createContext, useContext } from 'react';
import { makeMediaAsset } from './media.js';

/**
 * Where property photos and floor plans come from (packet F2). The browser demo keeps
 * inline data (`src`); the connected CRM stores files privately and supplies URLs through
 * its provider. Components ask `src(asset, record)` for a preview and `full(...)` to open.
 */
const browserSource = Object.freeze({
  stored: false,
  src: (asset) => asset?.src || '',
  full: (asset) => asset?.src || '',
  makeAsset: makeMediaAsset,
});

export const MediaSourceContext = createContext(browserSource);

export const useMediaSource = () => useContext(MediaSourceContext);
