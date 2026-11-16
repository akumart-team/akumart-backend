require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { Controller, Get, Post, Req, Body, UseGuards, UnauthorizedException, BadRequestException, ValidationPipe } = require('@nestjs/common');
const build = process.env.AKUMART_TEST_BUILD || '../dist';
const { AkubinHttpLoggingMiddleware } = require(build + '/modules/akubin/middleware/akubin-http-logging.middleware');
const { StartBinSessionDto } = require(build + '/modules/akubin/dto/hardware.dto');
const actor = '00000000-0000-4000-8000-000000000001';
class Deny { canActivate() { throw new UnauthorizedException('Sign in to continue.'); } }
class Probe {
  summary(req) { req.user = {id:actor}; return {data:{pin:'87654321',phone:'+2348012345678'}}; }
  denied() { return {}; }
  validate(body) { return body; }
  hardware(body) { if(body.identifier==='valid') return {data:{sessionId:'00000000-0000-4000-8000-000000000003'}}; throw new BadRequestException(`No active session for ${body.identifier}; phone ${body.phone}; ${body.deviceKey}`); }
  broken() { throw new BadRequestException('First validation problem\nsecond line'); }
  internal() { throw new Error('private database password hidden-secret'); }
}
Controller('api/v1')(Probe);
const decorate=(name,decorator)=>decorator(Probe.prototype,name,Object.getOwnPropertyDescriptor(Probe.prototype,name));
decorate('summary',Get('akubin/me/summary'));Req()(Probe.prototype,'summary',0);
decorate('denied',Get('admin/akubin/bins'));decorate('denied',UseGuards(Deny));
decorate('validate',Post('akubin/validate'));Body()(Probe.prototype,'validate',0);Reflect.defineMetadata('design:paramtypes',[StartBinSessionDto],Probe.prototype,'validate');
decorate('hardware',Post('akubin/sessions/phone-pin'));Body()(Probe.prototype,'hardware',0);
decorate('broken',Get('akubin/bins/:code'));
decorate('internal',Get('webhooks/akubin-telemetry'));
function logger() {
 const entries=[];const middleware=new AkubinHttpLoggingMiddleware();
 middleware.logger=Object.fromEntries(['log','warn','error'].map(level=>[level,value=>entries.push({level,...JSON.parse(value)})]));
 return {entries,middleware};
}
test('AkuBin structured HTTP logging',async t=>{
 const module=await Test.createTestingModule({controllers:[Probe]}).compile();
 const app=module.createNestApplication({logger:false});const {entries,middleware}=logger();
 app.use(middleware.use.bind(middleware));app.useGlobalPipes(new ValidationPipe({whitelist:true,transform:true}));
 await app.init();t.after(()=>app.close());const api=request(app.getHttpServer());
 const complete=()=>entries.filter(entry=>entry.event==='akubin.request.completed').at(-1);
 await t.test('correlates success, verified user, route and duration without logging response/query/header secrets',async()=>{
  const result=await api.get('/api/v1/akubin/me/summary?email=private@example.test&token=secret-query').set('Authorization','Bearer hidden-auth').set('Cookie','refresh_token=hidden-cookie').expect(200);
  const entry=complete();assert.equal(entry.requestId,result.headers['x-request-id']);assert.equal(entry.userId,actor);assert.equal(entry.endpoint,'/api/v1/akubin/me/summary');assert.equal(entry.auth,'bearer');assert.equal(entry.outcome,'success');assert.equal(entry.level,'log');assert.equal(typeof entry.durationMs,'number');assert.ok(entry.durationMs>=0);
  assert.equal(entries.filter(item=>item.requestId===entry.requestId).length,2);
  for(const secret of ['87654321','+2348012345678','private@example.test','secret-query','hidden-auth','hidden-cookie'])assert.ok(!JSON.stringify(entries).includes(secret),secret);
 });
 await t.test('correlates a newly created hardware session without logging its PIN',async()=>{
  await api.post('/api/v1/akubin/sessions/phone-pin').send({binId:'AKUBIN-001',identifier:'valid'}).expect(201);
  assert.equal(complete().sessionId,'00000000-0000-4000-8000-000000000003');
 });
 await t.test('captures errors thrown by an authentication guard',async()=>{
  await api.get('/api/v1/admin/akubin/bins').expect(401);const entry=complete();assert.equal(entry.status,401);assert.equal(entry.level,'warn');assert.deepEqual(entry.errors,['Sign in to continue.']);
 });
 await t.test('captures validation errors before a handler runs',async()=>{
  await api.post('/api/v1/akubin/validate').send({identifier:'12345678'}).expect(400);const entry=complete();assert.equal(entry.status,400);assert.ok(entry.errors.length);assert.ok(!JSON.stringify(entry).includes('12345678'));
 });
 await t.test('reports bin context while redacting secrets from hardware errors',async()=>{
  await api.post('/api/v1/akubin/sessions/phone-pin').set('x-akubin-device-key','hidden-key').send({binId:'AKUBIN-001',identifier:'ABCD5678',phone:'+2348012345678',deviceKey:'hidden-key'}).expect(400);
  const entry=complete();assert.equal(entry.binId,'AKUBIN-001');assert.equal(entry.auth,'device-key');assert.ok(entry.errors[0].includes('[REDACTED]'));
  for(const secret of ['ABCD5678','+2348012345678','hidden-key'])assert.ok(!JSON.stringify(entry).includes(secret),secret);
 });
 await t.test('does not log invalid path parameters or line breaks in error text',async()=>{
  await api.get('/api/v1/akubin/bins/00152026').expect(400);const entry=complete();assert.equal(entry.endpoint,'/api/v1/akubin/bins/:id');assert.ok(!JSON.stringify(entry).includes('00152026'));assert.ok(!entry.errors[0].includes('\n'));
 });
 await t.test('marks unexpected failures as errors without exposing internal exception details',async()=>{
  await api.get('/api/v1/webhooks/akubin-telemetry').expect(500);const entry=complete();assert.equal(entry.level,'error');assert.deepEqual(entry.errors,['Internal server error']);assert.ok(!JSON.stringify(entries).includes('hidden-secret'));
 });
 await t.test('records disconnected requests once with status 499',()=>{
  const {middleware:local,entries:logs}=logger();const response=new EventEmitter();response.setHeader=()=>{};response.json=()=>{};response.statusCode=200;response.writableFinished=false;
  local.use({method:'POST',originalUrl:'/api/v1/akubin/sessions/id/deposits',params:{},body:{},get:()=>undefined},response,()=>{});
  response.emit('close');response.emit('finish');const finished=logs.filter(item=>item.event!=='akubin.request.started');assert.equal(finished.length,1);assert.equal(finished[0].status,499);assert.equal(finished[0].event,'akubin.request.aborted');
 });
});
