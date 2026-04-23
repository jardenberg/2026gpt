const express = require('express');
const request = require('supertest');

const { getPauseModeConfig, renderPausePage, startPauseModeServer } = require('../pauseMode');

describe('pauseMode', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.APP_TITLE = '2026GPT';
    process.env.CUSTOM_FOOTER = 'Big Truck Co - Enterprise AI';
    process.env.DOMAIN_SERVER = 'https://2026gpt.jardenberg.se';
    delete process.env.APP_PAUSED_MESSAGE;
    delete process.env.APP_PAUSED_DETAIL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should render the default paused copy', () => {
    const html = renderPausePage(getPauseModeConfig());

    expect(html).toContain('2026GPT is paused.');
    expect(html).toContain('The service is paused until further notice.');
    expect(html).toContain('Big Truck Co - Enterprise AI');
  });

  it('should expose lightweight endpoints while paused', async () => {
    const app = express();
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };

    const listenSpy = jest.spyOn(app, 'listen').mockImplementation((_port, _host, callback) => {
      callback();
      return { close: jest.fn() };
    });

    startPauseModeServer({
      app,
      host: '127.0.0.1',
      logger,
      port: 0,
      trustedProxy: 1,
    });

    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.text).toBe('OK');

    const config = await request(app).get('/api/config');
    expect(config.status).toBe(200);
    expect(config.body).toMatchObject({
      appTitle: '2026GPT',
      customFooter: 'Big Truck Co - Enterprise AI',
      pauseMode: true,
      serverDomain: 'https://2026gpt.jardenberg.se',
      socialLoginEnabled: false,
    });

    const api = await request(app).get('/api/messages');
    expect(api.status).toBe(503);
    expect(api.body).toEqual({
      message: 'The service is paused until further notice.',
      pauseMode: true,
    });

    const page = await request(app).get('/c/new');
    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toMatch(/html/);
    expect(page.text).toContain('2026GPT is paused.');
    expect(page.headers['cache-control']).toBe('no-store, no-cache, must-revalidate');
    expect(page.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');

    listenSpy.mockRestore();
  });
});
