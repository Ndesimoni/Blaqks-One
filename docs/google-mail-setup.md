# Google mail setup

How the owner connects the CRM to the company's Google Workspace so each person can send
and receive client email from their own company mailbox (packet E1, decisions D4 and O7).
The CRM side is built and tested against a stand-in for Google; these steps connect it to
the real Google. Nothing here is needed for development or the test suites.

## What you need

- **Google Workspace on your own domain** (for example `keyswithsimoni.com`), with one
  mailbox per person who will email clients. Personal `@gmail.com` addresses cannot
  connect (decision O7).
- The Workspace **super administrator** account, to create the Google Cloud app.

## Steps (about 15 minutes)

1. Sign in to [Google Cloud console](https://console.cloud.google.com) with the Workspace
   administrator account and create a project, for example "Keys with Simoni CRM".
2. In **APIs & Services → Library**, enable the **Gmail API**.
3. In **Google Auth Platform**:
   - **Branding:** app name "Keys with Simoni CRM", your support email and logo.
   - **Audience:** choose **Internal**. Only your Workspace's people can sign in, and
     Google does not need to review the app.
   - **Data access:** add the scopes `https://www.googleapis.com/auth/gmail.send` and
     `https://www.googleapis.com/auth/gmail.readonly`.
4. In **Clients**, create an **OAuth client** of type **Web application** and add this
   **authorised redirect URI** exactly:
   - local development: `http://localhost:5173/api/crm/integrations/google/callback`
   - the hosted CRM later: `https://<your CRM address>/api/crm/integrations/google/callback`
5. Copy the **client ID** and **client secret** into the project's `.env` file yourself
   (never paste the secret into a chat, email or document):

   ```
   CRM_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   CRM_GOOGLE_CLIENT_SECRET=...
   CRM_GOOGLE_WORKSPACE_DOMAIN=keyswithsimoni.com
   ```

6. Restart the API (`npm run dev:api`). Each person then opens **My mailbox** in the CRM,
   chooses **Connect Google**, and signs in to their own company mailbox.

## Trying it before the Google setup

A local stand-in for Google lets you click through connecting and sending with pretend
mailboxes. Nothing reaches Google or a real inbox.

1. In `.env`, set `CRM_GOOGLE_CLIENT_ID` and `CRM_GOOGLE_CLIENT_SECRET` to any test values
   and `CRM_GOOGLE_ENDPOINT=http://127.0.0.1:8792` (local development only; the API
   refuses this setting anywhere else).
2. Run `npm run dev:google`, `npm run dev:api`, `npm run dev:worker` and `npm run dev`.
3. Open **My mailbox**, choose **Connect Google mailbox**, type any address on the pretend
   sign-in page, then use **New email** or **Reply** in the Inbox.

Remove `CRM_GOOGLE_ENDPOINT` and use the real values from the steps above when Google is set
up.

## Who can connect

- The Admin connects their own mailbox.
- Staff connect their own mailbox once the Admin turns on their **Email** access in Team
  (decision O8). The Admin can see and disconnect every company mailbox.
- Disconnecting removes the stored access and revokes it at Google.

## What the CRM can do with the mailbox

Send email the person writes in the CRM, and read the replies to conversations the CRM
started or from linked clients, so they appear in the Inbox (E1b, E1c). It never sends
anything by itself and stores no other mail.
