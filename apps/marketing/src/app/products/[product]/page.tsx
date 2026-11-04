import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Arrow } from '@/components/Arrow';
import { Dashboard } from '@/components/Dashboard';
import { Reveal } from '@/components/Reveal';
import { ChatArt, ListingArt, OffersArt } from '@/components/RowArt';
import { SecHead } from '@/components/SecHead';
import { productByKey, products } from '@/lib/products';
import { links } from '@/lib/site';

export const dynamicParams = false;
export const generateStaticParams = () => products.map((p) => ({ product: p.key }));

export async function generateMetadata({
  params,
}: PageProps<'/products/[product]'>): Promise<Metadata> {
  const product = productByKey((await params).product);
  return product ? { title: product.name, description: product.sub } : {};
}

const art = {
  dashboard: <Dashboard />,
  listing: <ListingArt />,
  offers: <OffersArt />,
  chat: <ChatArt />,
};

/** A product page: what it is, an example, and its six features. */
export default async function ProductPage({ params }: PageProps<'/products/[product]'>) {
  const product = productByKey((await params).product);
  if (!product) notFound();
  return (
    <>
      <section className="sec page-top" aria-labelledby="product-title">
        <div className="wrap">
          <SecHead
            level={1}
            tag={product.name}
            id="product-title"
            title={product.title}
            sub={product.sub}
          />
          <div className="hero-btns" style={{ marginBottom: 56 }}>
            <a className="btn btn-gold" href={links.signUp}>
              Start free <Arrow />
            </a>
            <a className="btn btn-dark" href="/contact">
              Talk to us <Arrow />
            </a>
          </div>
          <Reveal>{art[product.art]}</Reveal>
        </div>
      </section>
      <section className="sec flush" aria-labelledby="features-title">
        <div className="wrap">
          <SecHead tag="Features" id="features-title" title={`What you get with ${product.name}`} />
          <div className="who">
            {product.features.map(([title, text], i) => (
              <Reveal key={title} className="who-card" delay={(i % 4) * 0.05}>
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
