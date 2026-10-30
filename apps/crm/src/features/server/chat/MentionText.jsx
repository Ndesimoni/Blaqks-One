import React from 'react';
import { mentionParts } from './mentionModel.js';

/**
 * A message's text with its mentions highlighted (packet C3); a mention of the reader
 * stands out. `named` holds the mentioned members' IDs and names. Rendered as text only.
 */
export function MentionText({ body, named, me }) {
  const parts = mentionParts(body, named);
  return (
    <p className="chat-body">
      {parts.map((part, index) =>
        part.id ? (
          <span key={index} className={'chat-mention' + (part.id === me ? ' is-me' : '')}>
            {part.text}
          </span>
        ) : (
          <React.Fragment key={index}>{part.text}</React.Fragment>
        ),
      )}
    </p>
  );
}
