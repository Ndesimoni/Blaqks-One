import { Reveal } from './Reveal';

type Props = {
  tag: string;
  title: string;
  id: string;
  sub?: string;
  sample?: string;
  level?: 1 | 2;
};

/** A section's tag, heading and line, centred; level 1 opens a page. */
export function SecHead({ tag, title, id, sub, sample, level = 2 }: Props) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <Reveal className="sec-head">
      <span className="tag">{tag}</span>
      <Heading id={id}>{title}</Heading>
      {sub && <p>{sub}</p>}
      {sample && <span className="sample">{sample}</span>}
    </Reveal>
  );
}
