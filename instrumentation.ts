import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { reportApiError } = await import('@/lib/api-errors');
    // Route templates contain no customer IDs, query values or credentials.
    reportApiError(error, `${request.method} ${context.routePath}`);
  }
};
