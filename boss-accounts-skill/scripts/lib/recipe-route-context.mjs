const ROUTE_CONTEXT_ENV = 'YEEPAY_RECIPE_ROUTE_CONTEXT';

export function recipeRouteEnvironment(request, route, environment = process.env) {
  if (!route) return environment;
  return {
    ...environment,
    [ROUTE_CONTEXT_ENV]: JSON.stringify({ request, route })
  };
}

export function readRecipeRouteContext(request) {
  const serialized = process.env[ROUTE_CONTEXT_ENV];
  if (!serialized) return null;
  const context = JSON.parse(serialized);
  if (context.request !== request) throw new Error('快速配方的路由上下文与原始需求不一致。');
  if (!context.route || context.route.status !== 'resolved') throw new Error('快速配方缺少已解析的路由上下文。');
  return context.route;
}
