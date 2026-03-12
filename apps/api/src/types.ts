import 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    userId: string;
  }
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    wsGateway: any;
    waManager: any;
  }
}
