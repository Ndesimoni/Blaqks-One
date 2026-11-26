import { section } from './section.js';

export const activityLayouts = {
  'Interaction log': [
    section('conversation', 'Conversation details', [
      'log_id',
      'contacted_on_uae_time',
      'client_id',
      'channel',
      'direction',
      'conversation_topic',
      'property_id_optional',
      'deal_id_optional',
    ]),
    section('needs', 'Needs & objections', [
      'conversation_summary_client_needs',
      'objection_category',
      'exact_objection_concern',
      'commitment_made',
    ]),
    section('follow-up', 'Follow-up action', ['next_action', 'action_due', 'action_status']),
  ],
  'Client care': [
    section('relationship', 'Relationship & touchpoint', [
      'care_id',
      'client_id',
      'touchpoint_type',
      'property_id_optional',
      'last_contact',
      'client_relationship',
      'preferences_interests',
    ]),
    section('follow-up', 'Follow-up & referrals', [
      'next_contact',
      'task_status',
      'referral_outcome',
      'referred_client_id',
      'conversation_notes',
    ]),
  ],
};
