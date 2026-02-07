import { supabase } from "../config/supabase.js";

export const getProfile = async (req, res) => {
  const email = req.user?.email;
  if (!email) return res.status(403).json({ message: "No user email" });

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("username, email, created_at")
      .eq("email", email)
      .single();

    if (error || !user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ user });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
