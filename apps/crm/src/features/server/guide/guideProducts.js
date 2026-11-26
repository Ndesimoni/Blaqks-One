/** Guide articles for Websites, Marketplace, Messages and Settings (design queue item 13). */
export const productGuides = [
  {
    id: 'publish',
    topic: 'Websites',
    section: 'Website properties',
    title: 'Publishing a property on your website',
    path: ['Websites', 'Properties', 'Publish a property'],
    intro:
      'Publishing copies the public details to your website. Private details never leave the CRM.',
    steps: [
      'Open a property and choose Publish on website, or choose Publish a property in Websites → Properties.',
      'Fix anything listed under Ready to publish?, such as the price or the listing title.',
      'Choose the agent shown on the listing and where it appears: your website and the Blaqks One site, or your website only.',
      'Check the photos, floor plans and listing details, then choose Publish now.',
      'Later changes in the CRM stay private until you republish.',
    ],
  },
  {
    id: 'request',
    topic: 'Marketplace',
    section: 'Marketplace',
    title: 'Posting a client request and choosing an offer',
    path: ['Marketplace', 'My requests', 'Post a request'],
    intro:
      'Other brokers answer your client request with property offers. Your client is never named.',
    steps: [
      'In Marketplace, choose Post a request and pick the client.',
      'Describe what they need: buying or renting, emirate, areas, property type, bedrooms and budget.',
      'Confirm your client agreed to share what they are looking for, then choose Post request.',
      'Up to three brokers can offer a property at a time. Open Offers and messages to review them.',
      'Choose Proceed with this property, or Not a match to free the slot.',
    ],
  },
  {
    id: 'reply',
    topic: 'Messages',
    section: 'Inbox',
    place: 'Client inbox',
    title: 'Replying to a client from the Client inbox',
    path: ['Messages', 'Client inbox'],
    intro:
      "Client email and WhatsApp messages arrive in the Client inbox. Messages from known clients join that client's conversation.",
    steps: [
      'Open Messages, or the chat button in the top bar, and choose Client inbox.',
      'Choose Mine, Unassigned or Team, then the conversation.',
      'Write your reply and choose Send.',
      'Use a saved reply for common answers. The client name and your name are filled in for you.',
    ],
  },
  {
    id: 'whatsapp-number',
    topic: 'Settings',
    section: 'Channels',
    title: 'Giving a WhatsApp number to a member',
    path: ['Settings', 'Channels', "Members' numbers"],
    intro:
      "Each WhatsApp number from the company's Twilio account belongs to one member at a time.",
    steps: [
      'Open Settings → Channels and connect WhatsApp with the company Twilio account.',
      'Give the member WhatsApp access in Team & access. Only members with it can hold a number.',
      "Under Members' numbers, choose Give a number.",
      'Choose the member, then one of the WhatsApp numbers registered in Twilio. They see it under My WhatsApp.',
    ],
  },
  {
    id: 'invite',
    topic: 'Settings',
    section: 'Team & access',
    title: 'Inviting a teammate',
    path: ['Settings', 'Team & access', 'Invite teammate'],
    intro: 'Your seats cover you, your active teammates and pending invitations.',
    steps: [
      'Open Settings → Team & access and choose Invite teammate.',
      'Enter their name, email and phone, and choose their positions.',
      'Adjust their module access and their WhatsApp and email permissions if needed.',
      'They join from the invitation and work in your team workspace.',
    ],
  },
];
