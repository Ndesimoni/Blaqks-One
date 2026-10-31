import React from 'react';

function TitleSection({ heading, caption, action }) {
  return (
    <div className="section-top">
      <div>
        <h2>{heading}</h2>
        {caption && <p>{caption}</p>}
      </div>
      {action}
    </div>
  );
}

export { TitleSection };
