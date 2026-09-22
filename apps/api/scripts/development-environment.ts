export function assertDevelopmentEnvironment(action: string): void {
  if (process.env.NODE_ENV !== 'development') throw new Error(`${action} requires NODE_ENV=development.`);
}
