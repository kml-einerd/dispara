import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  request.log.error(error);

  // ── Zod validation errors ──
  if (error instanceof ZodError) {
    const response: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    };
    reply.status(400).send(response);
    return;
  }

  // ── Prisma known request errors ──
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        // Unique constraint violation
        const target = (error.meta?.target as string[]) ?? [];
        const response: ErrorResponse = {
          error: {
            code: 'CONFLICT',
            message: `A record with the given ${target.join(', ')} already exists`,
            details: { prismaCode: error.code, target },
          },
        };
        reply.status(409).send(response);
        return;
      }
      case 'P2025': {
        // Record not found
        const response: ErrorResponse = {
          error: {
            code: 'NOT_FOUND',
            message: 'The requested resource was not found',
            details: { prismaCode: error.code },
          },
        };
        reply.status(404).send(response);
        return;
      }
      default: {
        const response: ErrorResponse = {
          error: {
            code: 'DATABASE_ERROR',
            message: 'A database error occurred',
            details:
              process.env.NODE_ENV === 'development'
                ? { prismaCode: error.code, message: error.message }
                : undefined,
          },
        };
        reply.status(500).send(response);
        return;
      }
    }
  }

  // ── Prisma validation errors ──
  if (error instanceof Prisma.PrismaClientValidationError) {
    const response: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data provided to the database',
        details:
          process.env.NODE_ENV === 'development'
            ? { message: error.message }
            : undefined,
      },
    };
    reply.status(400).send(response);
    return;
  }

  // ── Fastify errors (rate-limit, auth, etc.) ──
  if ('statusCode' in error && typeof (error as FastifyError).statusCode === 'number') {
    const fastifyErr = error as FastifyError;
    const response: ErrorResponse = {
      error: {
        code: fastifyErr.code || 'REQUEST_ERROR',
        message: fastifyErr.message,
      },
    };
    reply.status(fastifyErr.statusCode ?? 500).send(response);
    return;
  }

  // ── Generic / unknown errors ──
  const response: ErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.message || 'An unexpected error occurred',
    },
  };
  reply.status(500).send(response);
}
