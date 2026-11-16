const {test}=require('node:test');
const assert=require('node:assert/strict');
const build=process.env.AKUMART_TEST_BUILD || '../dist';
const {Prisma}=require(build+'/generated/prisma/client');
const {pointsValueNaira}=require(build+'/modules/akubin/services/points-value');
for(const [points,rate,expected] of [['0','20','0.00'],['100','20','2000.00'],['0.025','20','0.50'],['0.1','0.2','0.02'],['0.005','1','0.01'],['999999999999.999','20','19999999999999.98'],['2.5','7.5','18.75']])test(`exact equivalent for ${points} points at ${rate}`,()=>assert.equal(pointsValueNaira(new Prisma.Decimal(points),new Prisma.Decimal(rate)),expected));
test('missing or invalid rate does not invent an equivalent',()=>{
 assert.equal(pointsValueNaira(new Prisma.Decimal(10),null),null);
 assert.equal(pointsValueNaira(new Prisma.Decimal(10),new Prisma.Decimal(-1)),null);
});
