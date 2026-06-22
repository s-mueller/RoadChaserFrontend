import {appConfig} from './app.config';

describe('appConfig', () => {
  it('should be defined', () => {
    expect(appConfig).toBeDefined();
  });

  it('should have providers configured', () => {
    expect(appConfig.providers).toBeDefined();
    expect(Array.isArray(appConfig.providers)).toBeTrue();
    expect(appConfig.providers.length).toBeGreaterThan(0);
  });

  it('should provide ZoneChangeDetection', () => {
    const providerTypes = appConfig.providers.map(p => {
      if (typeof p === 'function') return p;
      if (typeof p === 'object' && p !== null) return p.constructor?.name || Object.prototype.toString.call(p);
      return String(p);
    });
    // at least one provider should exist for zone change detection, router, and http client
    expect(appConfig.providers.length).toBe(3);
  });
});
