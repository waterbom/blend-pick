const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./support/load.cjs');

function mailEnv(t, values) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key,process.env[key]]));
  Object.assign(process.env,values);
  t.after(() => {for(const [key,value] of Object.entries(previous)){if(value === undefined)delete process.env[key];else process.env[key]=value;}});
}

const valid = {
  kind: 'supplier-proposal',
  name: '김담당',
  contact: 'partner@example.com',
  company: '배움 스튜디오',
  proposalCategory: '교육·클래스',
  productName: '주말 도예 입문 클래스',
  message: '주말 도예 수업을 공동구매로 제안합니다. 일정과 인원은 협의할 수 있습니다.',
  consent: true,
};

const request = body => new Request('https://shop.blendpunch.com/api/inquiry', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

function route(userId = null, sendMail = async () => true) {
  return load('app/api/inquiry/route.ts', {
    'next/headers': { cookies: async () => ({ get: () => userId ? { value: 'mock-session' } : undefined }) },
    '@/lib/supplier-mail': { sendSupplierProposalEmail: sendMail },
    '@/lib/auth': { verifyToken: async () => userId ? { id: userId } : null },
  });
}

function captureLogs(t) {
  const lines = [];
  t.mock.method(console, 'warn', line => lines.push(line));
  t.mock.method(console, 'error', line => lines.push(line));
  return lines;
}

test('education proposal reaches the existing inquiry service once with supported category and session identity', async t => {
  const calls = [];
  t.mock.method(global, 'fetch', async (url, init) => {
    calls.push({ url, init });
    return Response.json({ ok: true });
  });
  const response = await route('supplier-user').POST(request({ ...valid, name: `  ${valid.name} `, company: ` ${valid.company} ` }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, emailSent: true });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/inquiries/api/submit'));
  const { init } = calls[0];
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.ok(init.signal instanceof AbortSignal);
  assert.equal(init.body.get('name'), valid.name);
  assert.equal(init.body.get('contact'), valid.contact);
  assert.equal(init.body.get('category'), '서비스문의');
  assert.equal(init.body.get('user_id'), 'supplier-user');
  assert.match(init.body.get('message'), /^\[공급사 공구 제안\]/);
  assert.ok(init.body.get('message').includes(`회사·브랜드명: ${valid.company}`));
  assert.ok(init.body.get('message').includes(`제안 분야: ${valid.proposalCategory}`));
  assert.ok(init.body.get('message').includes(`상품·서비스명: ${valid.productName}`));
  assert.ok(init.body.get('message').endsWith(valid.message));
  assert.equal(init.body.has('kind'), false);
});

test('missing consent, invalid categories, malformed contacts and invalid bounds fail before any upstream write', async t => {
  captureLogs(t);
  let writes = 0;
  t.mock.method(global, 'fetch', async () => { writes++; return Response.json({ ok: true }); });
  const { POST } = route();
  const { SUPPLIER_FIELD_LIMITS } = load('lib/supplier-proposal.ts');
  const invalid = [
    { consent: false }, { consent: 'true' }, { consent: null },
    { proposalCategory: 'unsupported category' }, { proposalCategory: ['교육·클래스'] },
    { contact: 'invalid@example' }, { contact: 'call me 01012345678' },
    { contact: '010-12' }, { contact: '1234567890123456' },
    { company: '회사\n[제안 내용]' }, { name: { nested: 'input' } },
  ];
  for (const [field, { min, max }] of Object.entries(SUPPLIER_FIELD_LIMITS)) {
    invalid.push({ [field]: ' '.repeat(min) }, { [field]: '가'.repeat(max + 1) });
  }
  for (const patch of invalid) {
    const response = await POST(request({ ...valid, ...patch }));
    assert.equal(response.status, 400, JSON.stringify(patch));
    assert.equal((await response.json()).code, 'INVALID_INPUT');
  }
  assert.equal(writes, 0);
});

test('proposal accepts listed categories and normalizes telephone and multiline content without fabricating user IDs', async t => {
  const calls = [];
  t.mock.method(global, 'fetch', async (_url, init) => { calls.push(init.body); return Response.json({ ok: true }); });
  const { SUPPLIER_CATEGORIES } = load('lib/supplier-proposal.ts');
  const { POST } = route();
  for (const proposalCategory of SUPPLIER_CATEGORIES) {
    const response = await POST(request({ ...valid, proposalCategory, contact: '+82 (10) 1234-5678', message: `${valid.message}\r\n추가 일정도 협의 가능합니다.` }));
    assert.equal(response.status, 200);
  }
  assert.equal(calls.length, SUPPLIER_CATEGORIES.length);
  for (const body of calls) {
    assert.equal(body.has('user_id'), false);
    assert.doesNotMatch(body.get('message'), /\r/);
  }
});

test('legacy inquiry payload remains compatible', async t => {
  let forwarded;
  t.mock.method(global, 'fetch', async (_url, init) => { forwarded = init.body; return Response.json({ ok: true }); });
  const legacy = { name: '고객', contact: '010-1234-5678', category: '제품문의', message: '배송 일정 문의합니다.' };
  const response = await route().POST(request(legacy));
  assert.equal(response.status, 200);
  assert.deepEqual(Object.fromEntries(forwarded), legacy);
});

test('upstream HTTP and connection failures never become success, leak submitted details or retry writes', async t => {
  const logs = captureLogs(t);
  const secret = 'private upstream diagnostic supplier@example.com';
  for (const failure of ['http', 'network', 'timeout']) {
    let attempts = 0;
    t.mock.method(global, 'fetch', async () => {
      attempts++;
      if (failure === 'http') return new Response(secret, { status: 500 });
      const error = new Error(secret);
      if (failure === 'timeout') error.name = 'TimeoutError';
      throw error;
    });
    const response = await route().POST(request(valid));
    const body = await response.json();
    assert.equal(response.status, failure === 'timeout' ? 504 : 503);
    assert.equal(body.ok, false);
    assert.equal(body.code, failure === 'timeout' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE');
    assert.equal(body.retryable, false);
    assert.equal(attempts, 1);
    const visible = JSON.stringify([body, ...logs]);
    assert.ok(!visible.includes(secret));
    assert.ok(!visible.includes(valid.contact));
    assert.ok(!visible.includes(valid.message));
  }
});


test('supplier mail runs after persistence and failure does not resubmit an accepted proposal', async t => {
  const events = [];
  t.mock.method(global, 'fetch', async () => { events.push('saved'); return Response.json({ok:true}); });
  const response = await route(null, async proposal => { events.push('mail'); assert.equal(proposal.company, valid.company); return false; }).POST(request(valid));
  assert.deepEqual(events, ['saved','mail']);
  assert.deepEqual(await response.json(), {ok:true,emailSent:false});
  events.length = 0;
  await route(null, async () => { events.push('mail'); return true; }).POST(request({name:'고객',contact:'01012345678',category:'제품문의',message:'배송 문의'}));
  assert.deepEqual(events,['saved']);
  captureLogs(t);
  t.mock.method(global, 'fetch', async () => new Response('',{status:503}));
  let emails = 0;
  await route(null, async () => { emails++; return true; }).POST(request(valid));
  assert.equal(emails,0);
});

test('supplier email uses fixed inbox, plain text and validated reply address only', async t => {
  mailEnv(t,{GMAIL_USER:'sender@example.com',GMAIL_APP_PASSWORD:'mock-password'});
  const messages=[]; let closed=0;
  const {sendSupplierProposalEmail}=load('lib/supplier-mail.ts', {'nodemailer': {createTransport: options => {
    assert.equal(options.requireTLS,true);
    return {sendMail: async message => {messages.push(message);return {accepted:['blendpunch9799@blendpunch.com']};},close:()=>{closed++;}};
  }}});
  assert.equal(await sendSupplierProposalEmail({...valid,message:'<script>example</script> '+valid.message,to:'other@example.com'}),true);
  assert.equal(messages[0].to,'blendpunch9799@blendpunch.com');
  assert.equal(messages[0].replyTo.address,valid.contact);
  assert.match(messages[0].text,/담당자명: 김담당/);
  assert.equal(messages[0].html,undefined);
  assert.equal(messages[0].disableFileAccess,true);
  assert.equal(messages[0].disableUrlAccess,true);
  await sendSupplierProposalEmail({...valid,contact:'010-1234-5678'});
  assert.equal(messages[1].replyTo,undefined);
  await sendSupplierProposalEmail({...valid,contact:'bad@example.com>, <other'});
  assert.equal(messages[2].replyTo,undefined);
  assert.equal(closed,3);
});

test('missing SMTP settings, failed sends and rejected recipient report failure without exposing input',async t=>{
  const logs=captureLogs(t); let calls=0;
  mailEnv(t,{GMAIL_USER:'',GMAIL_APP_PASSWORD:''});
  const blocked=load('lib/supplier-mail.ts',{'nodemailer':{createTransport:()=>{throw Error('must not connect');}}});
  assert.equal(await blocked.sendSupplierProposalEmail(valid),false);
  Object.assign(process.env,{GMAIL_USER:'sender@example.com',GMAIL_APP_PASSWORD:'mock-password'});
  for(const failure of ['throw','reject']){
    const mail=load('lib/supplier-mail.ts',{'nodemailer':{createTransport:()=>({sendMail:async()=>{calls++;if(failure==='throw')throw Error(valid.contact+' mock-password');return {accepted:[],rejected:['blendpunch9799@blendpunch.com']};},close:()=>{}})}});
    assert.equal(await mail.sendSupplierProposalEmail(valid),false);
  }
  assert.equal(calls,2);
  assert.doesNotMatch(JSON.stringify(logs),/partner@example|mock-password/);
});
