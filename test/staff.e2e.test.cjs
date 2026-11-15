// Real HTTP/guards/Prisma/PostgreSQL; no remote services or .env.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
const path = require('node:path');
const request = require('supertest');
const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client');
const { Global, Module, ValidationPipe, VersioningType } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const { ConfigModule, ConfigService } = require('@nestjs/config');
const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
const { PrismaService } = require('../dist/integrations/database/prisma.service');
const { SupabaseService } = require('../dist/integrations/supabase/supabase.service');
const { PlatformModule } = require('../dist/common/platform/platform.module');
const { AdminModule } = require('../dist/modules/admin/admin.module');

test('Staff bootstrap, delegation, revocation and audit', { timeout: 180000 }, async t => {
  const db = await PGlite.create();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text NOT NULL, raw_user_meta_data jsonb DEFAULT '{}');`);
  const migrationRoot = path.join(__dirname, '..', 'prisma', 'migrations');
  for (const folder of (await readdir(migrationRoot, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort()) {
    await db.exec(await readFile(path.join(migrationRoot, folder, 'migration.sql'), 'utf8'));
  }
  const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 5 });
  await socket.start();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: `postgresql://postgres@${socket.getServerConn()}/postgres`, max: 1 }) });
  let app;
  t.after(async () => {
    if (app) await app.close();
    await prisma.$disconnect();
    await socket.stop();
    await db.close();
  });
  const ids = Object.fromEntries(['founder', 'member', 'second', 'operations', 'unverified'].map(name => [name, randomUUID()]));
  for (const [name, id] of Object.entries(ids)) {
    await prisma.$executeRaw`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES (${id}::uuid, ${`${name}@example.test`}, '{}'::jsonb)`;
  }
  class TestDatabaseModule {}
  Global()(TestDatabaseModule);
  Module({ providers: [{ provide: PrismaService, useValue: prisma }], exports: [PrismaService] })(TestDatabaseModule);
  const module = await Test.createTestingModule({ imports: [
    TestDatabaseModule,
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, ignoreEnvVars: true, load: [() => ({ STAFF_BOOTSTRAP_PROFILE_ID: ids.founder })] }),
    PlatformModule, AdminModule,
  ] }).overrideProvider(SupabaseService).useValue({ admin: { auth: {
    getUser: async token => ({ data: { user: Object.values(ids).includes(token) ? {
      id: token, email_confirmed_at: token === ids.unverified ? undefined : new Date().toISOString(),
    } : null }, error: null }),
  } } }).compile();
  app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  const api = request(app.getHttpServer());
  const config = module.get(ConfigService);
  async function invoke(method, route, actor, body, expected) {
    let req = api[method]('/api/v1' + route);
    if (actor) req = req.set('Authorization', `Bearer ${ids[actor]}`);
    if (body !== undefined) req = req.send(body);
    const response = await req;
    assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(response.body)}`);
    return response.body;
  }
  const assignment = (role, active = true) => ({ role, active, reason: 'Staff test access configuration' });

  await t.test('bootstrap requires authentication, explicit server configuration and verified allowlisted identity', async () => {
    await invoke('post', '/admin/staff/bootstrap', null, undefined, 401);
    config.set('STAFF_BOOTSTRAP_PROFILE_ID', '');
    await invoke('post', '/admin/staff/bootstrap', 'founder', undefined, 404);
    config.set('STAFF_BOOTSTRAP_PROFILE_ID', ids.founder);
    await invoke('post', '/admin/staff/bootstrap', 'member', undefined, 403);
    config.set('STAFF_BOOTSTRAP_PROFILE_ID', ids.unverified);
    await invoke('post', '/admin/staff/bootstrap', 'unverified', undefined, 403);
    config.set('STAFF_BOOTSTRAP_PROFILE_ID', ids.founder);
    assert.equal(await prisma.staffMembership.count(), 0);
    const result = await invoke('post', '/admin/staff/bootstrap', 'founder', undefined, 201);
    assert.equal(result.data.role, 'super');
    assert.equal(result.data.active, true);
    await invoke('post', '/admin/staff/bootstrap', 'founder', undefined, 409);
    assert.equal(await prisma.auditLog.count({ where: { action: 'staff.bootstrapped' } }), 1);
  });

  await t.test('ordinary users and operations staff cannot grant or inspect staff roles', async () => {
    await invoke('get', '/admin/staff', 'member', undefined, 403);
    await invoke('put', `/admin/staff/${ids.member}`, 'member', assignment('super'), 403);
    await invoke('put', `/admin/staff/${ids.operations}`, 'founder', assignment('operations'), 200);
    await invoke('get', '/admin/staff', 'operations', undefined, 403);
    await invoke('put', `/admin/staff/${ids.member}`, 'operations', assignment('super'), 403);
  });

  await t.test('validated assignments require an existing account and do not erase history on deactivation', async () => {
    await invoke('put', '/admin/staff/not-a-uuid', 'founder', assignment('support'), 400);
    await invoke('put', `/admin/staff/${randomUUID()}`, 'founder', assignment('support'), 404);
    await invoke('put', `/admin/staff/${ids.member}`, 'founder', assignment('owner'), 400);
    await invoke('put', `/admin/staff/${ids.member}`, 'founder', { ...assignment('support'), active: null }, 400);
    await invoke('put', `/admin/staff/${ids.member}`, 'founder', { ...assignment('support'), reason: 'x' }, 400);
    assert.equal(await prisma.staffMembership.count({ where: { profileId: ids.member } }), 0);
    await invoke('put', `/admin/staff/${ids.member}`, 'founder', assignment('support'), 200);
    await invoke('get', '/admin/me', 'member', undefined, 200);
    await invoke('put', `/admin/staff/${ids.member}`, 'founder', assignment('finance', false), 200);
    await invoke('get', '/admin/me', 'member', undefined, 403);
    const row = await prisma.staffMembership.findUnique({ where: { profileId: ids.member } });
    assert.equal(row.active, false);
    assert.equal(row.role, 'finance');
    const audit = await prisma.auditLog.findFirst({ where: { resourceId: ids.member, action: 'staff.assigned' }, orderBy: { createdAt: 'desc' } });
    assert.equal(audit.actorId, ids.founder);
    assert.deepEqual(audit.detail.before, { role: 'support', active: true });
    assert.deepEqual(audit.detail.after, { role: 'finance', active: false });
    assert.equal(audit.detail.reason, assignment('finance').reason);
    const found = await invoke('get', '/admin/staff?search=member%40example.test', 'founder', undefined, 200);
    assert.equal(found.pagination.total, 1);
    assert.equal(found.data[0].profile.email, 'member@example.test');
  });

  await t.test('last super protection and concurrent demotions preserve an active administrator', async () => {
    await invoke('put', `/admin/staff/${ids.founder}`, 'founder', assignment('super', false), 409);
    await invoke('put', `/admin/staff/${ids.founder}`, 'founder', assignment('support'), 409);
    await invoke('put', `/admin/staff/${ids.second}`, 'founder', assignment('super'), 200);
    const outcomes = await Promise.all([
      api.put(`/api/v1/admin/staff/${ids.founder}`).set('Authorization', `Bearer ${ids.founder}`).send(assignment('operations')),
      api.put(`/api/v1/admin/staff/${ids.second}`).set('Authorization', `Bearer ${ids.second}`).send(assignment('support')),
    ]);
    assert.equal(outcomes.filter(r => r.status === 200).length, 1);
    assert.ok(outcomes.every(r => [200, 403, 409].includes(r.status)), JSON.stringify(outcomes.map(r => r.body)));
    assert.equal(await prisma.staffMembership.count({ where: { role: 'super', active: true } }), 1);
  });

  await t.test('historical super membership prevents reopening bootstrap; routes are documented and protected', async () => {
    config.set('STAFF_BOOTSTRAP_PROFILE_ID', ids.member);
    await invoke('post', '/admin/staff/bootstrap', 'member', undefined, 409);
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().addBearerAuth().build());
    for (const [route, verb] of [['/api/v1/admin/staff', 'get'], ['/api/v1/admin/staff/{profileId}', 'put'], ['/api/v1/admin/staff/bootstrap', 'post']]) {
      assert.ok(doc.paths[route][verb].security.length);
    }
    assert.deepEqual(new Set(doc.components.schemas.AssignStaffDto.properties.role.enum), new Set(['super', 'operations', 'support', 'finance', 'content']));
  });
});
