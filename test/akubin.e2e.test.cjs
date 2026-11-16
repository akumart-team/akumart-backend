// End-to-end HTTP -> Nest -> Prisma -> disposable PostgreSQL. No .env or remote services.
require('reflect-metadata');
const assert = require('node:assert/strict');
const build = process.env.AKUMART_TEST_BUILD || '../dist';
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { readdir, readFile } = require('node:fs/promises');
const path = require('node:path');
const request = require('supertest');
const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require(build + '/generated/prisma/client');
const {
  Global,
  Module,
  ValidationPipe,
  VersioningType,
} = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const { ConfigModule, ConfigService } = require('@nestjs/config');
const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
const { AkubinModule } = require(build + '/modules/akubin/akubin.module');
const {
  AkubinDatabase,
} = require(build + '/modules/akubin/services/akubin-database.service');
const {
  PrismaService,
} = require(build + '/integrations/database/prisma.service');
const {
  SupabaseService,
} = require(build + '/integrations/supabase/supabase.service');

test(
  'AkuBin firmware, account and staff endpoints',
  { timeout: 180_000 },
  async (t) => {
    const db = await PGlite.create();
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text NOT NULL, raw_user_meta_data jsonb DEFAULT '{}');`);
    const migrations = path.join(__dirname, '..', 'prisma', 'migrations');
    for (const folder of (await readdir(migrations, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()) {
      await db.exec(
        await readFile(path.join(migrations, folder, 'migration.sql'), 'utf8'),
      );
    }
    const socket = new PGLiteSocketServer({
      db,
      host: '127.0.0.1',
      port: 0,
      maxConnections: 5,
    });
    await socket.start();
    // getServerConn reports the bound ephemeral port after start().
    const prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: `postgresql://postgres@${socket.getServerConn()}/postgres`,
        max: 1,
      }),
    });
    let app;
    t.after(async () => {
      if (app) await app.close();
      await prisma.$disconnect();
      await socket.stop();
      await db.close();
    });

    const user = randomUUID();
    const other = randomUUID();
    const staff = randomUUID();
    const finance = randomUUID();
    for (const [id, name] of [
      [user, 'Member'],
      [other, 'Other'],
      [staff, 'Operations'],
      [finance, 'Finance'],
    ]) {
      await prisma.$executeRaw`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (${id}::uuid, ${`${name}@example.test`}, ${JSON.stringify({ first_name: name })}::jsonb)`;
    }
    await prisma.staffMembership.create({
      data: { profileId: staff, role: 'operations' },
    });
    await prisma.staffMembership.create({
      data: { profileId: finance, role: 'finance' },
    });
    await prisma.profile.update({
      where: { id: user },
      data: { phone: '08012345678', city: 'Lagos' },
    });

    class TestDatabaseModule {}
    Global()(TestDatabaseModule);
    Module({
      providers: [{ provide: PrismaService, useValue: prisma }],
      exports: [PrismaService],
    })(TestDatabaseModule);
    const module = await Test.createTestingModule({
      imports: [
        TestDatabaseModule,
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [
            () => ({
              AKUBIN_ALLOW_LEGACY_HARDWARE: 'true',
              AKUBIN_PIN_LOOKUP_SECRET:
                'a-test-only-secret-that-is-at-least-32-characters',
            }),
          ],
        }),
        AkubinModule,
      ],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        admin: {
          auth: {
            getUser: async (token) =>
              [user, other, staff, finance].includes(token)
                ? { data: { user: { id: token } }, error: null }
                : { data: { user: null }, error: new Error('invalid') },
          },
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    const api = request(app.getHttpServer());
    const auth = (token) => ({ Authorization: `Bearer ${token}` });
    const prefix = '/api/v1';
    let binId;
    let deviceId;
    let sessionId;
    let rewardId;

    await t.test(
      'versioned routes, authentication and staff permissions are enforced',
      async () => {
        await api.get(`${prefix}/akubin/me/wallet`).expect(401);
        await api.get('/api/akubin/bins').expect(404);
        await api
          .post(`${prefix}/admin/akubin/bins`)
          .set(auth(user))
          .send({})
          .expect(403);
        await api
          .post(`${prefix}/admin/akubin/bins`)
          .set(auth(finance))
          .send({})
          .expect(403);
      },
    );

    await t.test(
      'operations registers bin and controller without firmware changes',
      async () => {
        const response = await api
          .post(`${prefix}/admin/akubin/bins`)
          .set(auth(staff))
          .send({
            code: 'AKUBIN-001',
            name: 'Ikeja',
            city: 'Lagos',
            area: 'Ikeja',
            latitude: 6.6,
            longitude: 3.3,
            materials: ['metal', 'plastic', 'paper'],
            hours: '24/7',
            status: 'online',
          })
          .expect(201);
        binId = response.body.data.id;
        const device = await api
          .post(`${prefix}/admin/akubin/bins/${binId}/devices`)
          .set(auth(staff))
          .send({ serialNumber: 'MASTER-001', authMode: 'legacy_bin_id' })
          .expect(201);
        deviceId = device.body.data.id;
        assert.equal(device.body.data.deviceKey, null);
        const publicBin = await api
          .get(`${prefix}/akubin/locations/AKUBIN-001`)
          .expect(200);
        assert.equal(publicBin.body.data.code, 'AKUBIN-001');
        assert.equal(publicBin.body.data.devices, undefined);
        await api
          .post(`${prefix}/admin/akubin/bins/${binId}/devices`)
          .set(auth(staff))
          .send({ serialNumber: 'MASTER-DUP', authMode: 'legacy_bin_id' })
          .expect(409);
      },
    );

    await t.test(
      'staff configures exact hardware reward rates and access boundaries',
      async () => {
        const rules = {
          pointValueNaira: '20',
          airtimeMinPoints: 0,
          cashMinPoints: 0,
          rates: [
            { material: 'metal', pointsPerGram: '0.025' },
            { material: 'plastic', pointsPerGram: '0.005' },
            { material: 'paper', pointsPerGram: '0.002' },
          ],
        };
        await api
          .patch(`${prefix}/admin/akubin/reward-rules`)
          .set(auth(staff))
          .send(rules)
          .expect(403);
        await api
          .patch(`${prefix}/admin/akubin/reward-rules`)
          .set(auth(finance))
          .send(rules)
          .expect(200);
        const result = await api
          .get(`${prefix}/akubin/reward-rules`)
          .expect(200);
        assert.equal(result.body.data.pointValueNaira, '20');
        assert.equal(
          result.body.data.rates.find((r) => r.material === 'metal')
            .pointsPerKg,
          '25',
        );
      },
    );

    await t.test(
      'PINs are provisioned securely and cannot be shared across accounts',
      async () => {
        const pin = await api
          .put(`${prefix}/akubin/me/pin`)
          .set(auth(user))
          .send({ pin: '001234' })
          .expect(200);
        assert.equal(pin.body.data.configured, true);
        assert.equal(JSON.stringify(pin.body).includes('001234'), false);
        await api
          .put(`${prefix}/akubin/me/pin`)
          .set(auth(other))
          .send({ pin: '001234' })
          .expect(409);
        await api
          .put(`${prefix}/akubin/me/pin`)
          .set(auth(user))
          .send({ pin: '999999', currentPin: '000000' })
          .expect(401);
        const status = await api
          .get(`${prefix}/akubin/me/pin`)
          .set(auth(user))
          .expect(200);
        assert.equal(status.body.data.configured, true);
        const record = await prisma.userSecurity.findUnique({
          where: { profileId: user },
        });
        assert.equal(record.failedPinAttempts, 1);
        assert.ok(record.pinHash.startsWith('$argon2id$'));
        assert.notEqual(record.pinLookupHash, '001234');
      },
    );

    await t.test(
      'session accepts the exact master payload and returns data.sessionId',
      async () => {
        await api
          .post(`${prefix}/akubin/sessions/phone-pin`)
          .send({ binId: 'AKUBIN-001', identifier: '000000' })
          .expect(401);
        const session = await api
          .post(`${prefix}/akubin/sessions/phone-pin`)
          .send({ binId: 'AKUBIN-001', identifier: '001234' })
          .expect(200);
        sessionId = session.body.data.sessionId;
        assert.ok(sessionId);
        const repeat = await api
          .post(`${prefix}/akubin/sessions/phone-pin`)
          .send({ binId: 'AKUBIN-001', identifier: '001234' })
          .expect(200);
        assert.equal(repeat.body.data.sessionId, sessionId);
        await api
          .get(`${prefix}/akubin/me/sessions/${sessionId}`)
          .set(auth(other))
          .expect(404);
      },
    );

    await t.test(
      'DTO validation rejects malformed hardware input',
      async () => {
        await api
          .post(`${prefix}/akubin/sessions/not-a-uuid/deposits`)
          .send({})
          .expect(400);
        await api
          .post(`${prefix}/akubin/sessions/${sessionId}/deposits`)
          .send({
            binId: 'AKUBIN-001',
            material: 'metal',
            weight_g: -5,
            idempotencyKey: 'invalid',
          })
          .expect(400);
        await api.get(`${prefix}/akubin/bins?limit=100000`).expect(400);
      },
    );

    await t.test(
      'another PIN cannot replace an unexpired session even after 30 seconds idle',
      async () => {
        await api
          .put(`${prefix}/akubin/me/pin`)
          .set(auth(other))
          .send({ pin: '005678' })
          .expect(200);
        await api
          .post(`${prefix}/akubin/sessions/phone-pin`)
          .send({ binId: 'AKUBIN-001', identifier: '005678' })
          .expect(409);
        const database = module.get(AkubinDatabase);
        const originalNow = database.now;
        // Advance past the old idle threshold without waiting or changing stored ownership.
        database.now = async (tx) =>
          new Date((await originalNow.call(database, tx)).getTime() + 31000);
        const original = sessionId;
        try {
          await api
            .post(`${prefix}/akubin/sessions/phone-pin`)
            .send({ binId: 'AKUBIN-001', identifier: '005678' })
            .expect(409);
          const previous = await prisma.binSession.findUnique({
            where: { id: original },
          });
          assert.equal(previous.profileId, user);
          assert.equal(previous.status, 'active');
          assert.equal(
            previous.expiresAt.getTime() - previous.lastActivityAt.getTime(),
            300000,
          );
          assert.equal(sessionId, original);
        } finally {
          database.now = originalNow;
        }
      },
    );

    const event = {
      binId: 'AKUBIN-001',
      userId: other,
      material: 'metal',
      weight_g: 100,
      points: 999999,
      idempotencyKey: 'AKUBIN-001-12345-6789',
    };
    await t.test(
      'deposit ignores claimed identity/points and credits the correct wallet once',
      async () => {
        const result = await api
          .post(`${prefix}/akubin/sessions/${sessionId}/deposits`)
          .send(event)
          .expect(200);
        assert.equal(result.body.data.points, '2.5');
        assert.equal(result.body.data.balancePoints, '2.5');
        const renewed = await prisma.binSession.findUnique({
          where: { id: sessionId },
        });
        assert.equal(
          renewed.expiresAt.getTime() - renewed.lastActivityAt.getTime(),
          300000,
        );
        const duplicate = await api
          .post(`${prefix}/akubin/sessions/${sessionId}/deposits`)
          .send(event)
          .expect(200);
        assert.equal(duplicate.body.data.depositId, result.body.data.depositId);
        assert.equal(duplicate.body.data.duplicate, true);
        const afterRetry = await prisma.binSession.findUnique({
          where: { id: sessionId },
        });
        assert.equal(
          afterRetry.expiresAt.getTime(),
          renewed.expiresAt.getTime(),
        );
        assert.equal(
          afterRetry.lastActivityAt.getTime(),
          renewed.lastActivityAt.getTime(),
        );
        await api
          .post(`${prefix}/akubin/sessions/${sessionId}/deposits`)
          .send({ ...event, weight_g: 101 })
          .expect(409);
        const wallet = await api
          .get(`${prefix}/akubin/me/wallet`)
          .set(auth(user))
          .expect(200);
        assert.equal(wallet.body.data.balancePoints, '2.5');
        assert.equal(wallet.body.data.balanceValueNaira, '50.00');
        assert.equal(wallet.body.data.pointValueNaira, '20');
        const otherWallet = await api
          .get(`${prefix}/akubin/me/wallet`)
          .set(auth(other))
          .expect(200);
        assert.equal(otherWallet.body.data.balancePoints, '0');
        assert.equal(otherWallet.body.data.balanceValueNaira, '0.00');
        const ledger = await api
          .get(`${prefix}/akubin/me/points-ledger`)
          .set(auth(user))
          .expect(200);
        assert.equal(ledger.body.pagination.total, 1);
      },
    );

    await t.test(
      'redemption reserves funds/stock; rejection refunds exactly once',
      async () => {
        const reward = await api
          .post(`${prefix}/admin/akubin/rewards`)
          .set(auth(finance))
          .send({
            name: 'Test airtime',
            kind: 'airtime',
            costPoints: 1,
            valueLabel: '₦20 airtime',
            valueAmount: '20',
            stock: 1,
          })
          .expect(201);
        rewardId = reward.body.data.id;
        const body = {
          rewardId,
          idempotencyKey: 'redemption-1',
          phone: '08012345678',
        };
        const redemption = await api
          .post(`${prefix}/akubin/redemptions`)
          .set(auth(user))
          .send(body)
          .expect(201);
        assert.equal(redemption.body.data.status, 'pending_review');
        const repeat = await api
          .post(`${prefix}/akubin/redemptions`)
          .set(auth(user))
          .send(body)
          .expect(201);
        assert.equal(repeat.body.data.id, redemption.body.data.id);
        assert.equal(
          (await api.get(`${prefix}/akubin/me/wallet`).set(auth(user))).body
            .data.balancePoints,
          '1.5',
        );
        await api
          .post(`${prefix}/akubin/redemptions`)
          .set(auth(user))
          .send({ ...body, idempotencyKey: 'different-request' })
          .expect(409);
        await api
          .post(
            `${prefix}/admin/akubin/redemptions/${redemption.body.data.id}/decision`,
          )
          .set(auth(finance))
          .send({ decision: 'reject', reason: 'Test review' })
          .expect(200);
        await api
          .post(
            `${prefix}/admin/akubin/redemptions/${redemption.body.data.id}/decision`,
          )
          .set(auth(finance))
          .send({ decision: 'reject', reason: 'Repeated review' })
          .expect(200);
        assert.equal(
          (await api.get(`${prefix}/akubin/me/wallet`).set(auth(user))).body
            .data.balancePoints,
          '2.5',
        );
        assert.equal(
          (await prisma.reward.findUnique({ where: { id: rewardId } })).stock,
          1,
        );
      },
    );

    await t.test(
      'telemetry is serialized safely and sensor timeout cannot clear FULL',
      async () => {
        const body = {
          binId: 'AKUBIN-001',
          distance_cm: 10,
          isFull: true,
          timestamp: 12345,
        };
        const full = await api
          .post(`${prefix}/webhooks/akubin-telemetry`)
          .send(body)
          .expect(200);
        assert.equal(full.body.data.status, 'full');
        const fault = await api
          .post(`${prefix}/webhooks/akubin-telemetry`)
          .send({ ...body, distance_cm: 999, isFull: false })
          .expect(200);
        assert.equal(fault.body.data.status, 'full');
        assert.equal(fault.body.data.sensorValid, false);
        const reports = await api
          .get(`${prefix}/admin/akubin/bins/${binId}/telemetry`)
          .set(auth(staff))
          .expect(200);
        assert.equal(typeof reports.body.data[0].deviceUptimeMs, 'string');
        await api
          .post(`${prefix}/admin/akubin/bins/${binId}/collections`)
          .set(auth(staff))
          .send({ collector: 'Test collector' })
          .expect(201);
        assert.equal(
          (await api.get(`${prefix}/akubin/bins/AKUBIN-001`)).body.data.status,
          'online',
        );
      },
    );

    await t.test(
      'fulfilment requires approval and records the same receipt only once',
      async () => {
        const redemption = await api
          .post(`${prefix}/akubin/redemptions`)
          .set(auth(user))
          .send({
            rewardId,
            idempotencyKey: 'redemption-fulfill',
            phone: '08012345678',
          })
          .expect(201);
        const id = redemption.body.data.id;
        const receipt = {
          provider: 'manual_airtime',
          reference: 'existing-receipt-123',
        };
        await api
          .post(`${prefix}/admin/akubin/redemptions/${id}/fulfillment`)
          .set(auth(finance))
          .send(receipt)
          .expect(409);
        await api
          .post(`${prefix}/admin/akubin/redemptions/${id}/decision`)
          .set(auth(finance))
          .send({ decision: 'approve' })
          .expect(200);
        await api
          .post(`${prefix}/admin/akubin/redemptions/${id}/fulfillment`)
          .set(auth(finance))
          .send(receipt)
          .expect(200);
        const repeat = await api
          .post(`${prefix}/admin/akubin/redemptions/${id}/fulfillment`)
          .set(auth(finance))
          .send(receipt)
          .expect(200);
        assert.equal(repeat.body.data.duplicate, true);
        await api
          .post(`${prefix}/admin/akubin/redemptions/${id}/decision`)
          .set(auth(finance))
          .send({ decision: 'reject', reason: 'Too late' })
          .expect(409);
      },
    );

    await t.test(
      'ownership, end-session and historical idempotency survive closed sessions',
      async () => {
        await api
          .post(`${prefix}/akubin/me/sessions/${sessionId}/end`)
          .set(auth(other))
          .expect(404);
        await api
          .post(`${prefix}/akubin/me/sessions/${sessionId}/end`)
          .set(auth(user))
          .expect(200);
        await api
          .post(`${prefix}/akubin/sessions/${sessionId}/deposits`)
          .send({ ...event, idempotencyKey: 'late-deposit' })
          .expect(409);
        const oldRetry = await api
          .post(`${prefix}/akubin/sessions/${sessionId}/deposits`)
          .send(event)
          .expect(200);
        assert.equal(oldRetry.body.data.duplicate, true);
      },
    );

    await t.test(
      'legacy mode is opt-in and revocation blocks hardware access',
      async () => {
        const config = module.get(ConfigService);
        config.set('AKUBIN_ALLOW_LEGACY_HARDWARE', 'false');
        await api
          .post(`${prefix}/akubin/sessions/phone-pin`)
          .send({ binId: 'AKUBIN-001', identifier: '001234' })
          .expect(401);
        config.set('AKUBIN_ALLOW_LEGACY_HARDWARE', 'true');
        await api
          .delete(`${prefix}/admin/akubin/devices/${deviceId}`)
          .set(auth(staff))
          .expect(200);
        await api
          .post(`${prefix}/akubin/sessions/phone-pin`)
          .send({ binId: 'AKUBIN-001', identifier: '001234' })
          .expect(503);
        await api
          .post(`${prefix}/admin/akubin/bins/${binId}/devices`)
          .set(auth(staff))
          .send({
            serialNumber: 'MASTER-001-REPLACEMENT',
            authMode: 'legacy_bin_id',
          })
          .expect(201);
        await api
          .patch(`${prefix}/admin/akubin/bins/${binId}`)
          .set(auth(staff))
          .send({ status: 'online' })
          .expect(200);
        await api
          .delete(`${prefix}/admin/akubin/devices/${deviceId}`)
          .set(auth(staff))
          .expect(200);
        assert.equal(
          (await api.get(`${prefix}/akubin/bins/AKUBIN-001`)).body.data.status,
          'online',
        );
      },
    );

    await t.test(
      'credentialed controllers require their key and expired sessions are closed on reads',
      async () => {
        const bin = await api
          .post(`${prefix}/admin/akubin/bins`)
          .set(auth(staff))
          .send({
            code: 'AKUBIN-002',
            name: 'Second bin',
            city: 'Lagos',
            area: 'Ikeja',
            latitude: 6.6,
            longitude: 3.3,
            materials: ['metal'],
            hours: '24/7',
            status: 'online',
          })
          .expect(201);
        const device = await api
          .post(`${prefix}/admin/akubin/bins/${bin.body.data.id}/devices`)
          .set(auth(staff))
          .send({ serialNumber: 'MASTER-002', authMode: 'authenticated' })
          .expect(201);
        assert.equal(typeof device.body.data.deviceKey, 'string');
        await api
          .post(`${prefix}/akubin/sessions/phone-pin`)
          .send({ binId: 'AKUBIN-002', identifier: '001234' })
          .expect(401);
        const session = await api
          .post(`${prefix}/akubin/sessions/phone-pin`)
          .set('X-Akubin-Device-Key', device.body.data.deviceKey)
          .send({ binId: 'AKUBIN-002', identifier: '001234' })
          .expect(200);
        const record = await prisma.binSession.findUnique({
          where: { id: session.body.data.sessionId },
        });
        await prisma.binSession.update({
          where: { id: record.id },
          data: { expiresAt: new Date(record.lastActivityAt.getTime() + 1) },
        });
        const read = await api
          .get(`${prefix}/akubin/me/sessions/${record.id}`)
          .set(auth(user))
          .expect(200);
        assert.equal(read.body.data.status, 'expired');
        const next = await api
          .post(`${prefix}/akubin/sessions/phone-pin`)
          .set('X-Akubin-Device-Key', device.body.data.deviceKey)
          .send({ binId: 'AKUBIN-002', identifier: '005678' })
          .expect(200);
        assert.notEqual(next.body.data.sessionId, record.id);
        assert.equal(
          (await prisma.binSession.findUnique({ where: { id: record.id } }))
            .profileId,
          user,
        );
      },
    );

    await t.test(
      'account totals and leaderboard return authorized, exact points',
      async () => {
        const summary = await api
          .get(`${prefix}/akubin/me/summary`)
          .set(auth(user))
          .expect(200);
        assert.equal(summary.body.data.lifetimeEarnedPoints, '2.5');
        assert.equal(summary.body.data.lifetimeEarnedValueNaira, '50.00');
        await prisma.platformSettings.update({where:{id:1},data:{pointValueNaira:'7.5'}});
        const changed = await api.get(`${prefix}/akubin/me/summary`).set(auth(user)).expect(200);
        assert.equal(changed.body.data.pointValueNaira,'7.5');
        assert.equal(changed.body.data.lifetimeEarnedPoints,'2.5');
        assert.equal(changed.body.data.lifetimeEarnedValueNaira,'18.75');
        await prisma.platformSettings.update({where:{id:1},data:{pointValueNaira:'20'}});

        const board = await api
          .get(`${prefix}/akubin/leaderboard?period=all`)
          .set(auth(user))
          .expect(200);
        assert.equal(board.body.data[0].points, '2.500000');
        const beyond = await api
          .get(`${prefix}/akubin/leaderboard?period=all&page=2`)
          .set(auth(user))
          .expect(200);
        assert.equal(beyond.body.pagination.total, 1);
        assert.deepEqual(beyond.body.data, []);
        const doc = SwaggerModule.createDocument(
          app,
          new DocumentBuilder().addBearerAuth().build(),
        );
        assert.ok(doc.paths[`${prefix}/akubin/sessions/phone-pin`]);
        assert.ok(doc.paths[`${prefix}/webhooks/akubin-telemetry`]);
        for (const route of [
          `${prefix}/akubin/sessions/phone-pin`,
          `${prefix}/akubin/sessions/{id}/deposits`,
          `${prefix}/webhooks/akubin-telemetry`,
        ]) {
          const headers = doc.paths[route].post.parameters.filter(
            parameter => parameter.in === 'header' && parameter.name.toLowerCase() === 'x-akubin-device-key',
          );
          assert.equal(headers.length, 1, `${route}: duplicate device headers`);
          assert.equal(headers[0].required, false, `${route}: legacy firmware must be able to omit the header`);
        }
        assert.ok(
          doc.paths[`${prefix}/admin/akubin/redemptions/{id}/decision`],
        );
      },
    );
  },
);
