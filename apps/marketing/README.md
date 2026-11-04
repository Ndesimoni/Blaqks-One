# Blaqks One brokerage website

The public website that sells Blaqks One to brokerages and agents (owner decision, 2026-11-05:
this site is only for brokerages and agents; property seekers use the Blaqks One property site,
linked from the footer). It follows the approved design: a centred hero with an interactive line
mesh and the CRM dashboard rising through a gold-rimmed arc, product pages, Pricing, Help and
Contact, in the CRM's colours with light and dark modes. Animations use Framer Motion.

## Run it

```sh
npm install
npm run dev        # http://localhost:3002
npm test && npm run typecheck && npm run build
```

## Settings

| Variable | What it sets | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | This site's own address, for links and the sitemap | `http://localhost:3002` |
| `NEXT_PUBLIC_CRM_URL` | The CRM, for Start free and Sign in | `http://localhost:5173` |
| `NEXT_PUBLIC_PROPERTY_SITE_URL` | The Blaqks One property site, for Find a property | `http://localhost:3000` |
| `CONTACT_WEBHOOK_URL` | Where the contact form sends messages | not set: the form says sending is not switched on |

## Still placeholders

The logos, prices, listing images and contact details are samples and are tagged so on the page
(`src/lib/site.ts`, `src/lib/plans.ts`, `src/components/Logos.tsx`, `src/components/Gallery.tsx`).
Replace them before launch. Sign-up with Google, Facebook or Apple, a password-reset email and
Excel import for companies are not built yet, so the site does not offer them.
