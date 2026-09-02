import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Prisma CLI operations need a direct session connection. The running API
    // uses the pooled DATABASE_URL through PrismaService instead.
    url: env('DIRECT_DATABASE_URL'),
  },
});
