export function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: '請先登入' });
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: '請先登入' });
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: '權限不足' });
    }
    next();
  };
}
