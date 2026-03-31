const noIndex = (req, res, next) => {
  const shouldNoIndex = process.env.NO_INDEX ? process.env.NO_INDEX === 'true' : true;
  const publicPaths = ['/dash', '/roadmap'];
  const isPublicPage = publicPaths.some(
    (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`),
  );

  if (shouldNoIndex && !isPublicPage) {
    res.setHeader('X-Robots-Tag', 'noindex');
  }

  next();
};

module.exports = noIndex;
