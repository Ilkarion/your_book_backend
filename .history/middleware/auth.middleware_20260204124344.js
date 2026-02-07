import jwt from "jsonwebtoken";

export const requireAuth = (req, res, next) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(403).json({ message: "No token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { email }
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};
