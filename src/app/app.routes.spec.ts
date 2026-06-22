import {routes} from './app.routes';

describe('appRoutes', () => {
  it('should export a routes array', () => {
    expect(routes).toBeDefined();
    expect(Array.isArray(routes)).toBeTrue();
  });

  it('should be empty (no routes configured)', () => {
    expect(routes.length).toBe(0);
  });
});
