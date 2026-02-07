export const getProfile = async (req, res) => {
  try {
    const { email } = req.user;
    const { data: user } = await supabase
      .from("users")
      .select("username, email, created_at")
      .eq("email", email)
      .single();

    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
