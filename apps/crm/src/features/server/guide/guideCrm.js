/**
 * Guide articles for the CRM's clients and listings (design queue item 13). Each names the
 * section it describes (`section`), which also decides who sees it; steps use the real labels.
 */
export const crmGuides = [
  {
    id: 'first-client',
    topic: 'CRM',
    section: 'Clients',
    title: 'Adding a client and their first follow-up',
    path: ['CRM', 'Create', 'Lead'],
    intro: 'Every enquiry should become a client with a next step, so nothing is forgotten.',
    steps: [
      'Choose Create in the top bar, then Lead. Choose Client instead for someone past the first conversation.',
      'Add the name, phone and email, and what they are looking for: buy or rent, emirate, communities, property type and bedrooms.',
      'Set the minimum and maximum budget. The Client desk uses the budget and areas to find matching properties.',
      'Choose Create, then Follow-up. Pick the client, write the next action and set the due date.',
      'On the due date the follow-up appears under Today on the Dashboard and in Activities → Follow-ups.',
    ],
  },
  {
    id: 'client-desk',
    topic: 'CRM',
    section: 'Client desk',
    title: 'Matching properties on the Client desk',
    path: ['CRM', 'Clients', 'Client desk'],
    intro:
      'The Client desk shows the properties that fit a client, with the reason for each match.',
    steps: [
      'Open Clients, then the Client desk tab, and find the client.',
      'Check the matching properties and why each one matches.',
      'Choose Add to shortlist for the best ones.',
      'Send a match on WhatsApp, or post a marketplace request when nothing fits.',
    ],
  },
  {
    id: 'contacts',
    topic: 'CRM',
    section: 'Contacts',
    title: 'Keeping owners, developers and partners as contacts',
    path: ['CRM', 'Contacts'],
    intro:
      'Owners, developers and partner brokers are contacts, kept apart from the clients you help.',
    steps: [
      'Choose Create in the top bar, then Contact.',
      'Choose the contact type and add their company, phone and email.',
      'Add the building, community and emirate they are linked to.',
      'Open a contact from Contacts to call or message them.',
    ],
  },
  {
    id: 'listings',
    topic: 'CRM',
    section: 'Properties',
    title: 'Adding and managing your listings',
    path: ['CRM', 'Properties'],
    intro:
      "Each property holds its terms, photos and permit details. Private details, such as the owner's phone, stay in the CRM.",
    steps: [
      'Choose Create in the top bar, then Property.',
      'Add the purpose (sale, rent or holiday), price, size, location and status.',
      'Add photos and floor plans, then the permit details.',
      'In Properties, use the Available filter and the Cards view to see what you can offer.',
    ],
  },
  {
    id: 'leads',
    topic: 'CRM',
    section: 'Leads',
    title: 'Qualifying leads and moving them on',
    path: ['CRM', 'Leads'],
    intro: 'Leads are clients at an early stage. Track where they came from, then qualify them.',
    steps: [
      'Open Leads and choose a preset such as New this week, Hot or From the website.',
      'Open a lead to record their budget, urgency and how they will pay.',
      'In the Kanban view, move a lead to its next stage as it progresses.',
      'Choose Message on a lead to continue the conversation in Messages.',
    ],
  },
];
