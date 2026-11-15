// Export route/schema documentation without connecting to databases or providers.
require('reflect-metadata');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { Test } = require('@nestjs/testing');
const { VersioningType } = require('@nestjs/common');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
const { AppModule } = require('../dist/app.module');
const {
  PrismaService,
} = require('../dist/integrations/database/prisma.service');
const {
  SupabaseService,
} = require('../dist/integrations/supabase/supabase.service');
async function main() {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(SupabaseService)
    .useValue({})
    .compile();
  const app = module.createNestApplication({ logger: false });
  try {
    app.setGlobalPrefix('api', { exclude: ['/', 'health', 'health/live'] });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('AkuMart API')
        .setDescription(
          'See FRONTEND_API.md for setup, policies and integration flows. Decimal amounts are strings in NGN major units.',
        )
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    const folder = path.join(__dirname, '..', 'docs');
    await mkdir(folder, { recursive: true });
    await writeFile(
      path.join(folder, 'openapi.json'),
      JSON.stringify(doc, null, 2) + '\n',
    );
    const rows = Object.entries(doc.paths).flatMap(([route, methods]) =>
      Object.entries(methods)
        .filter(([verb]) =>
          ['get', 'post', 'put', 'patch', 'delete'].includes(verb),
        )
        .map(([verb, operation]) => ({
          tag: operation.tags?.[0] || 'General',
          route,
          verb,
          auth: operation.security?.length && !operation.security.some((requirement) => Object.keys(requirement).length === 0)
            ? 'Bearer'
            : 'Public / optional bearer',
          body: operation.requestBody?.content
            ? Object.values(operation.requestBody.content)
                .map(
                  (c) =>
                    c.schema?.$ref?.split('/').at(-1) || (c.schema?.type ?? ''),
                )
                .join(', ')
            : '—',
        })),
    );
    rows.sort(
      (a, b) =>
        a.tag.localeCompare(b.tag) ||
        a.route.localeCompare(b.route) ||
        a.verb.localeCompare(b.verb),
    );
    const lines = [
      '# Registered AkuMart API endpoints',
      '',
      'Generated with `npm run api:export`. Request schemas are in [openapi.json](openapi.json); setup and access rules are in [FRONTEND_API.md](FRONTEND_API.md). Staff restrictions are enforced in addition to bearer authentication.',
      '',
      '| Module | Method | Path | Authentication | Body schema |',
      '| --- | --- | --- | --- | --- |',
      ...rows.map(
        (r) =>
          `| ${r.tag} | ${r.verb.toUpperCase()} | \`${r.route}\` | ${r.auth} | ${r.body} |`,
      ),
      '',
      `Total: ${rows.length} operations.`,
      '',
    ];
    await writeFile(path.join(folder, 'ENDPOINTS.md'), lines.join('\n'));
    process.stdout.write(
      `Exported ${rows.length} operations and ${Object.keys(doc.components?.schemas ?? {}).length} schemas to docs/.\n`,
    );
  } finally {
    await app.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
