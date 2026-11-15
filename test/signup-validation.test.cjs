// Exercises the real Nest validation pipeline and auth service without sending email.
require('reflect-metadata');
require('ts-node').register({
  transpileOnly: true,
  experimentalResolver: true,
  compilerOptions: { rootDir: require('node:path').join(__dirname, '..') },
});
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ValidationPipe } = require('@nestjs/common');
const { RegisterDto } = require('../src/modules/auth/dto/register.dto.ts');
const { AuthService } = require('../src/modules/auth/auth.service.ts');
const valid = {
  firstName: ' Ada ',
  lastName: ' Obi ',
  displayName: ' Ada Recycles ',
  email: 'ADA@example.test',
  phone: '+2348012345678',
  city: ' Lagos ',
  marketRole: 'buyer',
  akubin: false,
  password: 'Test-only-pass123',
  acceptedTerms: true,
};
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const validate = (body) =>
  pipe.transform(body, { type: 'body', metatype: RegisterDto });
test('signup rejects missing required values, invalid role/contact and unaccepted terms', async (t) => {
  for (const field of Object.keys(valid))
    await t.test('missing ' + field, async () => {
      const body = { ...valid };
      delete body[field];
      await assert.rejects(validate(body), (e) => e.getStatus() === 400);
    });
  for (const [field, value] of [
    ['firstName', '   '],
    ['lastName', '   '],
    ['displayName', '   '],
    ['displayName', 'A'.repeat(101)],
    ['city', ' '],
    ['phone', '080'],
    ['email', 'invalid'],
    ['marketRole', 'none'],
    ['marketRole', 'recycler'],
    ['akubin', 'yes'],
    ['marketRole', 'super'],
    ['marketRole', 'operations'],
    ['acceptedTerms', false],
    ['password', 'short'],
  ])
    await t.test('invalid ' + field + ' ' + String(value), () =>
      assert.rejects(
        validate({ ...valid, [field]: value }),
        (e) => e.getStatus() === 400,
      ),
    );
});
test('four signup roles reach Supabase as ordinary metadata with an independent AkuBin choice', async () => {
  for (const role of ['buyer', 'seller', 'both', 'logistics']) {
    let sent;
    const provider = {
      client: () => ({
        auth: {
          signUp: async (body) => {
            sent = body;
            return { error: null };
          },
        },
      }),
    };
    const service = new AuthService(provider, {});
    const dto = await validate({ ...valid, marketRole: role });
    await service.register(dto);
    assert.equal(sent.options.data.market_role, role);
    assert.equal(sent.options.data.first_name, 'Ada');
    assert.equal(sent.options.data.display_name, 'Ada Recycles');
    assert.equal(sent.email, 'ada@example.test');
    assert.equal(sent.options.data.city, 'Lagos');
    assert.equal(sent.options.data.phone, valid.phone);
    assert.equal(sent.options.data.staff, undefined);
    assert.equal(sent.options.data.akubin, false);
  }
});
test('email verification saves either AkuBin choice without changing the account role', async () => {
  for (const akubin of [true, false]) {
    const session = {
      user: {
        id: 'verified-user',
        user_metadata: { akubin, display_name: ' Ada Recycles ' },
      },
    };
    let saved, savedProfile;
    const provider = {
      client: () => ({
        auth: { verifyOtp: async () => ({ data: { session }, error: null }) },
      }),
    };
    const service = new AuthService(provider, {
      $transaction: async (fn) =>
        fn({
          profile: {
            update: async (value) => {
              savedProfile = value;
            },
          },
          userPreferences: {
            update: async (value) => {
              saved = value;
            },
          },
        }),
    });
    assert.equal(
      await service.verifyEmail({
        email: 'person@example.test',
        code: '12345678',
      }),
      session,
    );
    assert.deepEqual(saved, {
      where: { profileId: 'verified-user' },
      data: { akubin },
    });
    assert.deepEqual(savedProfile, {
      where: { id: 'verified-user' },
      data: { displayName: 'Ada Recycles' },
    });
  }
});
