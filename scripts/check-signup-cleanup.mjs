import { execFileSync } from 'node:child_process';

function sql(compose, statement, capture = false) {
  const result = execFileSync(
    'docker',
    [
      ...compose,
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'kws_crm_test',
      '-d',
      'kws_crm_test',
      capture ? '-tAc' : '-c',
      statement,
    ],
    { encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'ignore' },
  );
  return capture ? result.trim() : '';
}

export function seedExpiredSignup(compose) {
  sql(
    compose,
    `INSERT INTO crm_signup_requests(ticket_hash,email,existing_account,account_type,name,phone,` +
      `password_hash,language,terms_version,privacy_version,code_hash,created_at,last_sent_at,` +
      `code_expires_at,expires_at) VALUES('${'a'.repeat(64)}','expired-cleanup@example.test',false,` +
      `'brokerage','Expired cleanup','+971501234567','synthetic','en','draft','draft',` +
      `'${'b'.repeat(64)}',now()-interval '2 days',now()-interval '2 days',` +
      `now()-interval '25 hours',now()-interval '24 hours'); ` +
      `INSERT INTO crm_signup_outbox(request_id,kind,code) SELECT id,'code','123456' ` +
      `FROM crm_signup_requests WHERE email='expired-cleanup@example.test'`,
  );
}

export function checkExpiredSignupRemoved(compose) {
  const remaining = sql(
    compose,
    `SELECT count(*) FROM crm_signup_requests WHERE email='expired-cleanup@example.test'`,
    true,
  );
  if (remaining !== '0') throw Error('Sign-up startup cleanup did not remove expired data.');
}
