# Connecting platforms

What the owner sets up outside the CRM so each channel can work with real clients. The CRM
side of every channel is built and tested first against a local stand-in, so none of this is
needed for development. Provider requirements change; confirm each step on the provider's own
site when you do it. Never paste an API key, secret or password into a chat, email or
document: type it into the CRM's Connections screen or the `.env` file yourself.

## Status (2026-10-21)

| Channel                     | Provider            | CRM side               | Owner setup                               |
| --------------------------- | ------------------- | ---------------------- | ----------------------------------------- |
| Email (company domain)      | Twilio SendGrid     | Connection built (E3a) | Domain and SendGrid account, below        |
| Email (Google Workspace)    | Google              | Built (E1)             | [Google mail setup](google-mail-setup.md) |
| WhatsApp                    | Twilio              | Planned (W1, W2)       | Decisions D2 and D6 first                 |
| Facebook Page and Instagram | Meta                | Planned (S1)           | Meta business setup and app review        |
| TikTok direct messages      | TikTok for Business | Planned (T1)           | Business Messaging access (D9)            |

## Needed by every channel: a public HTTPS address (D7)

Providers deliver incoming messages and delivery statuses by calling the CRM over the
internet. On a laptop that needs a secure tunnel (for example Cloudflare Tunnel) during
testing; the hosted CRM later has its own address. Sending works without it; replies and
statuses do not.

## Email through SendGrid (packet E3)

1. **Buy the company domain** (for example `keyswithsimoni.com`) from any registrar that lets
   you edit DNS records. If the domain will have no other mailbox, the CRM receives all of its
   mail; otherwise tell us, and we use a receiving subdomain such as `crm.` (decision E3b).
2. **Create a Twilio SendGrid account** for the company and choose a plan. One company needs
   the Email API Essentials plan or a trial; check current prices on SendGrid's pricing page.
3. **Authenticate the domain:** in SendGrid, Settings → Sender Authentication → Authenticate
   Your Domain. SendGrid shows a few CNAME records; add them at your registrar and press
   Verify. This lets SendGrid sign mail as your domain, so it does not land in spam. When
   the same domain also receives mail through SendGrid (step 4), SendGrid asks for
   **Automatic Security to be switched off** for that domain, or mail can bounce in a loop;
   follow SendGrid's current Inbound Parse instructions for this.
4. **Point incoming mail at SendGrid:** add an MX record for the receiving domain with the
   value `mx.sendgrid.net` (priority 10). Do this only when you are ready for the CRM to
   receive that domain's mail.
5. **Add a DMARC record** (`_dmarc` TXT, starting with `v=DMARC1; p=none;`) so receiving
   servers trust the domain; it can be tightened later.
6. **Create an API key** in Settings → API Keys with **Custom Access**: Mail Send (Full),
   Sender Authentication (Read), Inbound Parse (Full) and Mail Settings → Event Notification
   (Full); everything else No Access. The CRM refuses a full-access key or any other
   permission. Paste the key into Channels → SendGrid; the CRM then checks the domain and
   sets up incoming mail and delivery events by itself.
7. **Protect the SendGrid account:** turn on two-factor sign-in and keep its teammates to the
   people who need them. Whoever controls the SendGrid account can send as any member outside
   the CRM.

If you later disconnect SendGrid in the CRM, change the MX record too; otherwise client mail
to the domain keeps going to SendGrid and is lost.

## WhatsApp through Twilio (W1, W2)

- Decide D2: keep the current WhatsApp number (only if Twilio supports moving it while you
  keep using the WhatsApp Business app in the UAE) or use a new dedicated number.
- Create a **Meta Business Portfolio** for the company (D6) and start business verification;
  WhatsApp senders are registered under it.
- Create a **Twilio account** (one per company, D3), add billing and register the WhatsApp
  sender in Twilio's console. Twilio and Meta both charge per conversation or message.
- Message templates for contacting clients first are approved by Meta; we prepare the wording.

## Facebook Page and Instagram (S1)

- A **Facebook Page** for the business and an **Instagram professional account** linked to it,
  both under the company's Meta Business Portfolio.
- A **Meta developer app** owned by the portfolio. In development mode it works for the
  owner's own Page straight away; serving clients beyond that needs Meta's **app review** for
  the messaging and lead permissions and business verification, which takes weeks.
- Meta allows replies to a person only for a limited time after their last message.

## TikTok direct messages (T1)

- A **TikTok Business Account** and approval for TikTok's **Business Messaging API**; confirm
  the UAE is eligible before we build T1 (D9).

## What the CRM never does

- Read anything except client conversations and replies to CRM email.
- Search or scrape other people's social posts, or message anyone automatically.
- Send bulk messages (a later, separately reviewed feature).
