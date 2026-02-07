import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export const requireAuth = (req, res, next) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(403).json({ message: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // добавляем данные токена в req.user
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};
