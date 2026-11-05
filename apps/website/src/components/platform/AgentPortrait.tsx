import type { Agent } from '../../lib/types';
import { initials } from '../ui';

export function AgentPortrait({ agent }: { agent: Agent }) {
  return (
    <div
      className="platform-agent-portrait"
      role="img"
      aria-label={`Portrait space for ${agent.name}`}
    >
      <span>{initials(agent.name)}</span>
      <svg viewBox="0 0 140 150" aria-hidden="true">
        <circle cx="70" cy="45" r="24" />
        <path d="M22 145v-30a48 48 0 0 1 96 0v30" />
      </svg>
      <small>PORTRAIT SPACE</small>
    </div>
  );
}
