// Real PostgreSQL SQL/trigger tests in memory. Never reads .env or connects to Supabase.
const { PGlite } = require('@electric-sql/pglite');
const { randomUUID } = require('node:crypto');
const { readdir, readFile } = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

test('migration replay and schema integrity', { timeout: 120_000 }, async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  // Minimal Supabase fixtures, not a replacement for final staging/RLS-role testing.
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text NOT NULL, raw_user_meta_data jsonb DEFAULT '{}');`);
  const root = path.join(__dirname, '..', 'prisma', 'migrations');
  const folders = (await readdir(root, { withFileTypes: true }))
    .filter((f) => f.isDirectory()).map((f) => f.name).sort();
  for (const folder of folders) {
    if (folder.endsWith('_schema_integrity')) {
      // Exercise the forward migration on populated legacy rows, not only empty tables.
      await db.exec(`
        INSERT INTO auth.users (id, email) VALUES
          ('10000000-0000-0000-0000-000000000001', 'legacy-buyer@example.test'),
          ('10000000-0000-0000-0000-000000000007', 'legacy-seller@example.test');
        UPDATE profiles SET profile_completed = true WHERE id = '10000000-0000-0000-0000-000000000001';
        INSERT INTO bins (id,code,name,city,area,latitude,longitude,materials,hours,updated_at)
          VALUES ('10000000-0000-0000-0000-000000000002','LEGACY','Legacy','Lagos','Ikeja',6,3,'{metal}','24/7',now());
        INSERT INTO bin_devices (id,bin_id,serial_number,credential_hash)
          VALUES ('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','LEGACY-DEVICE','hash');
        INSERT INTO bin_sessions (id,profile_id,bin_id,status,started_at,expires_at,ended_at,created_at)
          VALUES ('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',
          '10000000-0000-0000-0000-000000000002','ended',now()-interval '1 hour',now()+interval '1 hour',now(),now()-interval '1 hour');
        INSERT INTO deposits (id,session_id,bin_id,device_id,device_event_id,material,measure,amount,weight_kg,status,awarded_points,points_rate,measured_at)
          VALUES ('10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000004',
          '10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','LEGACY-EVENT','metal','weight',10,0.01,'verified',0.25,25,now());
        INSERT INTO listings (id,seller_id,title,material,grade,condition,quantity,unit,unit_price,min_order,city,area,description,updated_at)
          VALUES ('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000007','Legacy','metal','A','sorted',2,'kg',100,1,'Lagos','Ikeja','Legacy',now());
        INSERT INTO offers (id,listing_id,buyer_id,expires_at,updated_at)
          VALUES ('10000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001',now()+interval '1 hour',now());
        INSERT INTO uploads (id,owner_id,purpose,provider,storage_key,original_name,mime_type,size_bytes)
          VALUES ('10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','listing_image','test','legacy-file','legacy.jpg','image/jpeg',100);
      `);
    }
    const sql = await readFile(path.join(root, folder, 'migration.sql'), 'utf8');
    try { await db.exec(sql); }
    catch (error) { throw new Error(`Migration failed: ${folder}: ${error.message}`, { cause: error }); }
  }

  const insert = async (table, data) => {
    const row = { id: randomUUID(), ...data };
    const keys = Object.keys(row);
    const result = await db.query(
      `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
      Object.values(row),
    );
    return result.rows[0];
  };
  const reject = (sql, values, code = '23514') =>
    assert.rejects(db.query(sql, values), (error) => error.code === code);
  await t.test('forward migration preserves populated legacy attribution and session ownership', async () => {
    const profile = '10000000-0000-0000-0000-000000000001';
    assert.equal((await db.query(`SELECT uploaded_by_id FROM uploads WHERE storage_key = 'legacy-file'`)).rows[0].uploaded_by_id, profile);
    assert.equal((await db.query(`SELECT profile_id FROM deposits WHERE device_event_id = 'LEGACY-EVENT'`)).rows[0].profile_id, profile);
    assert.equal((await db.query(`SELECT device_id FROM bin_sessions WHERE id = '10000000-0000-0000-0000-000000000004'`)).rows[0].device_id, '10000000-0000-0000-0000-000000000003');
    assert.equal((await db.query(`SELECT seller_id FROM offers WHERE id = '10000000-0000-0000-0000-000000000008'`)).rows[0].seller_id, '10000000-0000-0000-0000-000000000007');
    assert.ok((await db.query('SELECT onboarded_at FROM profiles WHERE id = $1', [profile])).rows[0].onboarded_at);
  });
  const buyer = await insert('auth.users', { email: 'buyer@example.test' });
  const seller = await insert('auth.users', { email: 'seller@example.test' });
  const other = await insert('auth.users', { email: 'other@example.test' });
  const listing = await insert('listings', {
    seller_id: seller.id, title: 'Plastic', material: 'plastic', grade: 'A', condition: 'sorted',
    quantity: 10, unit: 'kg', unit_price: 100, min_order: 1, city: 'Lagos', area: 'Ikeja',
    description: 'Test', updated_at: new Date(),
  });
  const offer = await insert('offers', {
    listing_id: listing.id, buyer_id: buyer.id, seller_id: seller.id,
    expires_at: new Date(Date.now() + 3_600_000), updated_at: new Date(), status: 'accepted',
  });
  const orderData = {
    offer_id: offer.id, listing_id: listing.id, buyer_id: buyer.id, seller_id: seller.id,
    title: 'Plastic', material: 'plastic', quantity: 1, unit: 'kg', unit_price: 100,
    seller_fee_pct: 5, partner_fee_pct: 3, inspection_hours: 24,
    pickup_city: 'Lagos', pickup_area: 'Ikeja', updated_at: new Date(),
  };

  await t.test('signup initializes account rows and records terms without inventing privacy consent', async () => {
    const user = await insert('auth.users', {
      email: 'terms@example.test',
      raw_user_meta_data: { terms_version: '1.0', terms_accepted_at: new Date().toISOString() },
    });
    for (const table of ['user_preferences', 'user_security', 'points_wallets']) {
      assert.equal((await db.query(`SELECT count(*)::int AS count FROM ${table} WHERE profile_id = $1`, [user.id])).rows[0].count, 1);
    }
    const consents = (await db.query('SELECT document, version FROM consent_records WHERE profile_id = $1', [user.id])).rows;
    assert.deepEqual(consents, [{ document: 'terms', version: '1.0' }]);
    await reject('DELETE FROM consent_records WHERE profile_id = $1', [user.id]);
  });

  await t.test('unique PIN lookup and verification hash pairing are enforced', async () => {
    const hash = 'a'.repeat(64);
    await reject('UPDATE user_security SET pin_lookup_hash = $1 WHERE profile_id = $2', [hash, buyer.id]);
    await db.query('UPDATE user_security SET pin_hash = $1, pin_lookup_hash = $2 WHERE profile_id = $3', ['slow-hash', hash, buyer.id]);
    await reject('UPDATE user_security SET pin_hash = $1, pin_lookup_hash = $2 WHERE profile_id = $3', ['slow-hash', hash, other.id], '23505');
  });

  await t.test('sold-out stock is valid; over-reservation is rejected', async () => {
    await db.query('UPDATE listings SET sold_quantity = 10, status = $1 WHERE id = $2', ['sold', listing.id]);
    await reject('UPDATE listings SET reserved_quantity = 1 WHERE id = $1', [listing.id]);
    await db.query('UPDATE listings SET sold_quantity = 0 WHERE id = $1', [listing.id]);
  });

  await t.test('order must match offer buyer, listing and seller', async () => {
    await assert.rejects(insert('orders', { ...orderData, buyer_id: other.id }), (e) => e.code === '23503');
    await assert.rejects(insert('orders', { ...orderData, seller_id: other.id }), (e) => e.code === '23503');
  });
  const order = await insert('orders', orderData);
  await t.test('only the order buyer can own a review', async () => {
    await reject('INSERT INTO order_reviews (order_id, buyer_id, stars) VALUES ($1, $2, 5)', [order.id, other.id], '23503');
    await db.query('INSERT INTO order_reviews (order_id, buyer_id, stars) VALUES ($1, $2, 5)', [order.id, buyer.id]);
  });

  const binData = { name: 'Test bin', city: 'Lagos', area: 'Ikeja', latitude: 6, longitude: 3, materials: '{metal,plastic,paper}', hours: '24/7', updated_at: new Date() };
  const binA = await insert('bins', { ...binData, code: 'TEST-A' });
  const binB = await insert('bins', { ...binData, code: 'TEST-B' });
  const deviceA = await insert('bin_devices', { bin_id: binA.id, serial_number: 'DEV-A', auth_mode: 'legacy_bin_id' });
  const deviceB = await insert('bin_devices', { bin_id: binB.id, serial_number: 'DEV-B', auth_mode: 'legacy_bin_id' });
  const session = await insert('bin_sessions', {
    profile_id: buyer.id, bin_id: binA.id, device_id: deviceA.id, expires_at: new Date(Date.now() + 3_600_000),
  });
  const depositData = {
    session_id: session.id, profile_id: buyer.id, bin_id: binA.id, device_id: deviceA.id,
    device_event_id: 'hardware-event-1', material: 'metal', measure: 'weight', amount: 10,
    weight_kg: '0.01', status: 'verified', awarded_points: '0.25', points_rate: 25,
  };

  await t.test('one active session per bin/user; identity is immutable', async () => {
    await assert.rejects(insert('bin_sessions', { profile_id: other.id, bin_id: binA.id, device_id: deviceA.id, expires_at: new Date(Date.now() + 3_600_000) }), (e) => e.code === '23505');
    await reject('UPDATE bin_sessions SET profile_id = $1 WHERE id = $2', [other.id, session.id]);
  });
  await t.test('deposits cannot cross bin, device or account boundaries', async () => {
    for (const changes of [{ bin_id: binB.id }, { device_id: deviceB.id }, { profile_id: other.id }]) {
      await assert.rejects(insert('deposits', { ...depositData, ...changes }), (e) => e.code === '23514');
    }
  });
  const deposit = await insert('deposits', depositData);
  await t.test('deposit credits preserve fractional points and update the wallet once', async () => {
    await assert.rejects(insert('points_ledger_entries', { profile_id: other.id, kind: 'deposit_credit', amount: '0.25', deposit_id: deposit.id, idempotency_key: 'wrong-owner' }), (e) => ['23503', '23514'].includes(e.code));
    await assert.rejects(insert('points_ledger_entries', { profile_id: buyer.id, kind: 'deposit_credit', amount: '1', deposit_id: deposit.id, idempotency_key: 'wrong-amount' }), (e) => e.code === '23514');
    await insert('points_ledger_entries', { profile_id: buyer.id, kind: 'deposit_credit', amount: '0.25', deposit_id: deposit.id, idempotency_key: 'deposit-credit-1' });
    await db.query(`INSERT INTO points_ledger_entries (id, profile_id, kind, amount, deposit_id, idempotency_key)
      VALUES ($1, $2, 'deposit_credit', 0.25, $3, 'deposit-credit-1') ON CONFLICT DO NOTHING`, [randomUUID(), buyer.id, deposit.id]);
    const wallet = (await db.query('SELECT balance::text AS balance, version FROM points_wallets WHERE profile_id = $1', [buyer.id])).rows[0];
    assert.deepEqual(wallet, { balance: '0.250000', version: 1 });
    await reject('UPDATE points_wallets SET balance = 500 WHERE profile_id = $1', [buyer.id]);
    await reject('DELETE FROM points_ledger_entries WHERE deposit_id = $1', [deposit.id]);
    await reject('UPDATE deposits SET awarded_points = 5 WHERE id = $1', [deposit.id]);
  });

  const reward = await insert('rewards', { name: 'Test reward', kind: 'airtime', cost_points: 1, value_label: 'Test', updated_at: new Date() });
  const redemption = await insert('redemptions', { profile_id: buyer.id, reward_id: reward.id, reward_name: reward.name, kind: 'airtime', cost_points: 1, idempotency_key: 'redeem-1', updated_at: new Date() });
  await t.test('redemption cannot overdraw or refund twice', async () => {
    const entry = { profile_id: buyer.id, kind: 'redemption_debit', amount: '-1', redemption_id: redemption.id, idempotency_key: 'debit-1' };
    await assert.rejects(insert('points_ledger_entries', entry), (e) => e.code === '23514');
    await insert('points_ledger_entries', { profile_id: buyer.id, kind: 'adjustment', amount: '1', reason: 'Test credit', idempotency_key: 'adjust-1' });
    await insert('points_ledger_entries', entry);
    await assert.rejects(insert('points_ledger_entries', { profile_id: buyer.id, kind: 'redemption_refund', amount: 1, redemption_id: redemption.id, idempotency_key: 'premature-refund' }), (e) => e.code === '23514');
    await db.query(`UPDATE redemptions SET status = 'rejected' WHERE id = $1`, [redemption.id]);
    await insert('points_ledger_entries', { profile_id: buyer.id, kind: 'redemption_refund', amount: 1, redemption_id: redemption.id, idempotency_key: 'refund-1' });
    await assert.rejects(insert('points_ledger_entries', { profile_id: buyer.id, kind: 'redemption_refund', amount: 1, redemption_id: redemption.id, idempotency_key: 'refund-2' }), (e) => e.code === '23505');
    assert.equal((await db.query('SELECT balance::text AS balance FROM points_wallets WHERE profile_id = $1', [buyer.id])).rows[0].balance, '1.250000');
  });

  await t.test('ended sessions reject new deposits and cannot reopen', async () => {
    await db.query(`UPDATE bin_sessions SET status = 'ended', ended_at = now() WHERE id = $1`, [session.id]);
    await assert.rejects(insert('deposits', { ...depositData, device_event_id: 'late-item' }), (e) => e.code === '23514');
    await reject(`UPDATE bin_sessions SET status = 'active', ended_at = NULL WHERE id = $1`, [session.id]);
  });

  await t.test('telemetry preserves device uptime separately from server time', async () => {
    const telemetry = await insert('bin_telemetry', { bin_id: binA.id, device_id: deviceA.id, distance_cm: 10, reported_full: true, device_uptime_ms: 12345 });
    assert.equal(Number(telemetry.device_uptime_ms), 12345);
    assert.ok(telemetry.received_at);
    await assert.rejects(insert('bin_telemetry', { bin_id: binA.id, device_id: deviceB.id, distance_cm: 10, reported_full: true, device_uptime_ms: 1 }), (e) => e.code === '23503');
  });

  await t.test('refund allocations cannot exceed the captured payment', async () => {
    const payment = await insert('payments', { order_id: order.id, provider: 'test', provider_reference: 'pay-1', idempotency_key: 'pay-1', amount: 100, status: 'succeeded', paid_at: new Date(), updated_at: new Date() });
    const refund = await insert('refunds', { payment_id: payment.id, idempotency_key: 'money-refund-1', amount: 60, reason: 'Test', status: 'completed', updated_at: new Date() });
    await reject(`UPDATE refunds SET status = 'failed' WHERE id = $1`, [refund.id]);
    await assert.rejects(insert('refunds', { payment_id: payment.id, idempotency_key: 'money-refund-2', amount: 50, reason: 'Test', updated_at: new Date() }), (e) => e.code === '23514');
    await reject('UPDATE payments SET amount = 500 WHERE id = $1', [payment.id]);
  });

  await t.test('all application tables have RLS and no direct anonymous/authenticated access', async () => {
    const tables = (await db.query(`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`)).rows;
    for (const table of tables) {
      assert.ok(table.relrowsecurity, `${table.relname}: RLS disabled`);
      for (const role of ['anon', 'authenticated']) {
        assert.equal((await db.query('SELECT has_table_privilege($1, $2, $3) AS allowed', [role, table.relname, 'SELECT'])).rows[0].allowed, false, `${role} can read ${table.relname}`);
      }
    }
  });
});
