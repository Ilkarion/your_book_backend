import { supabase } from "../config/supabase.js";
import bcrypt from "bcrypt";

export const getProfile = async (req, res) => {
  const { username, email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const hashed = await bcrypt.hash(password, 10);
    const confirmToken = crypto.randomBytes(32).toString("hex");

    // 1. Insert user
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert([
        { username, email, password: hashed, confirm_token: confirmToken }
      ])
      .select("id") // получаем id
      .single();

    if (userError) return res.status(400).json({ message: userError.message });

    // 2. Insert into usersRecords
    const { error: recordsError } = await supabase
      .from("usersRecords")
      .insert([{ id_user: userData.id, records: [], all_Tags: [], all_Color_Tags: [] }]);

    if (recordsError)
      return res.status(400).json({ message: recordsError.message });

    // 3. Send email
    try {
      await sendVerification(email, confirmToken);
    } catch (err) {
      console.error("Email send error:", err);
      return res.status(500).json({ message: "Email send failed" });
    }

    res.status(200).json({ message: "Registered! Check your email to confirm." });
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({ message: "Server error" });
  }
};
