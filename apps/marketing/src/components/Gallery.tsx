import { Reveal } from './Reveal';
import { Scene } from './Scene';
import { SecHead } from './SecHead';

const shots = [
  {
    sky: ['#1a2f3a', '#bc9765', '#e4cda5'],
    sun: [270, 300],
    seed: 7,
    water: '#15302a',
    title: 'Marina Gate · 2-bed',
    sub: 'AED 190,000 / yr · Dubai Marina',
  },
  {
    sky: ['#0e1c24', '#2f6b4a', '#e4cda5'],
    sun: [120, 270],
    seed: 21,
    water: '#10261c',
    title: 'Creek Harbour · 1-bed off-plan',
    sub: 'AED 1,450,000 · 60/40 plan',
  },
  {
    sky: ['#241a2a', '#a8664a', '#f3c48a'],
    sun: [210, 320],
    seed: 43,
    water: '#2a1e1c',
    title: 'Business Bay office',
    sub: 'AED 310,000 / yr · 3,100 sq ft',
  },
] as const;

/** Sample listing images, drawn in the page and tagged Sample until real photos are chosen. */
export function Gallery() {
  return (
    <section className="sec flush" aria-labelledby="gallery-title">
      <div className="wrap">
        <SecHead
          tag="Your listings"
          id="gallery-title"
          title="Listings that look their best everywhere"
          sub="The same photos and details on your website, the Blaqks One site and in the marketplace."
          sample="Sample images"
        />
        <div className="gallery">
          {shots.map((shot, i) => (
            <Reveal key={shot.title} as="figure" className="shot" delay={i * 0.08}>
              <Scene sky={[...shot.sky]} sun={[...shot.sun]} seed={shot.seed} water={shot.water} />
              <figcaption>
                <b>{shot.title}</b>
                <small>{shot.sub}</small>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
