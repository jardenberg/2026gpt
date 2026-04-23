const DEFAULT_PAUSE_MESSAGE = 'The service is paused until further notice.';
const DEFAULT_PAUSE_DETAIL =
  'Interactive chat, sign-in, file uploads, search, and model access are temporarily unavailable while the service is paused.';

const isEnvEnabled = (value) => {
  if (value == null) {
    return false;
  }

  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getPauseModeConfig = () => {
  const appTitle = process.env.APP_TITLE || '2026GPT';
  const customFooter = process.env.CUSTOM_FOOTER || '';
  const serverDomain = process.env.DOMAIN_SERVER || process.env.DOMAIN_CLIENT || '';

  return {
    appTitle,
    customFooter,
    serverDomain,
    pauseMode: true,
    socialLoginEnabled: false,
    pausedMessage: process.env.APP_PAUSED_MESSAGE || DEFAULT_PAUSE_MESSAGE,
    pausedDetail: process.env.APP_PAUSED_DETAIL || DEFAULT_PAUSE_DETAIL,
  };
};

const renderFooter = (customFooter) => {
  if (!customFooter) {
    return '';
  }

  return `<footer>${escapeHtml(customFooter)}</footer>`;
};

const renderPausePage = (config) => {
  const title = escapeHtml(config.appTitle);
  const pausedMessage = escapeHtml(config.pausedMessage);
  const pausedDetail = escapeHtml(config.pausedDetail);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow, noarchive" />
    <title>${title} | Paused</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3efe6;
        --card: rgba(255, 251, 244, 0.9);
        --text: #1f1a14;
        --muted: #5f5447;
        --line: rgba(31, 26, 20, 0.12);
        --accent: #a66a2c;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(166, 106, 44, 0.16), transparent 28%),
          radial-gradient(circle at bottom right, rgba(23, 19, 14, 0.1), transparent 32%),
          linear-gradient(160deg, #efe6d8 0%, var(--bg) 58%, #ede7df 100%);
      }

      main {
        display: grid;
        min-height: 100vh;
        place-items: center;
        padding: 32px 20px;
      }

      .card {
        width: min(720px, 100%);
        border: 1px solid var(--line);
        border-radius: 28px;
        background: var(--card);
        box-shadow: 0 28px 90px rgba(31, 26, 20, 0.12);
        backdrop-filter: blur(10px);
        padding: 40px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--accent);
      }

      .eyebrow::before {
        content: "";
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 0 6px rgba(166, 106, 44, 0.12);
      }

      h1 {
        margin: 20px 0 16px;
        font-size: clamp(2.2rem, 5vw, 4rem);
        line-height: 0.98;
        letter-spacing: -0.05em;
      }

      p {
        margin: 0;
        max-width: 42rem;
        color: var(--muted);
        font-size: 1rem;
        line-height: 1.75;
      }

      .detail {
        margin-top: 14px;
      }

      .status {
        margin-top: 28px;
        display: inline-flex;
        align-items: center;
        gap: 12px;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 10px 16px;
        background: rgba(255, 255, 255, 0.5);
        color: var(--muted);
        font-size: 0.95rem;
      }

      .status strong {
        color: var(--text);
      }

      footer {
        margin-top: 34px;
        padding-top: 20px;
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 0.92rem;
      }

      @media (max-width: 640px) {
        .card {
          padding: 28px 22px;
          border-radius: 22px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <div class="eyebrow">Service Pause</div>
        <h1>${title} is paused.</h1>
        <p>${pausedMessage}</p>
        <p class="detail">${pausedDetail}</p>
        <div class="status" aria-label="Current service status">
          <span>Status</span>
          <strong>Paused</strong>
        </div>
        ${renderFooter(config.customFooter)}
      </section>
    </main>
  </body>
</html>`;
};

const startPauseModeServer = ({ app, host, logger, port, trustedProxy }) => {
  const config = getPauseModeConfig();
  const html = renderPausePage(config);

  app.disable('x-powered-by');
  app.set('trust proxy', trustedProxy);
  app.use((_req, res, next) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    });
    next();
  });

  app.get('/health', (_req, res) => res.status(200).send('OK'));
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain');
    res.send('User-agent: *\nDisallow: /');
  });
  app.get('/api/config', (_req, res) => {
    res.status(200).json({
      appTitle: config.appTitle,
      serverDomain: config.serverDomain,
      socialLoginEnabled: false,
      customFooter: config.customFooter,
      pauseMode: true,
    });
  });
  app.use('/api', (_req, res) => {
    res.status(503).json({
      message: config.pausedMessage,
      pauseMode: true,
    });
  });
  app.use((_req, res) => {
    res.type('html');
    res.send(html);
  });

  app.listen(port, host, (err) => {
    if (err) {
      logger.error('Failed to start pause-mode server:', err);
      process.exit(1);
    }

    logger.warn('APP_PAUSED is enabled. Starting lightweight pause-mode server.');

    if (host === '0.0.0.0') {
      logger.info(
        `Pause-mode server listening on all interfaces at port ${port}. Use http://localhost:${port} to access it`,
      );
    } else {
      logger.info(
        `Pause-mode server listening at http://${host == '0.0.0.0' ? 'localhost' : host}:${port}`,
      );
    }
  });
};

module.exports = {
  getPauseModeConfig,
  isPauseModeEnabled: () => isEnvEnabled(process.env.APP_PAUSED),
  renderPausePage,
  startPauseModeServer,
};
