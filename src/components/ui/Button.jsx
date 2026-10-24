import React from 'react';
import { Icon } from './Icon.jsx';

function Button({
  children,
  variant = 'primary',
  icon,
  onClick,
  disabled = false,
  title = '',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      title={title || undefined}
      className={'btn btn-' + variant + ' ' + className}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={16} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

export { Button };
