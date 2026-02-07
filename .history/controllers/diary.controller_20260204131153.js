import { supabase } from "../config/supabase.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

// ===== GET DIARY =====
export const getDiary = async (req, res) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(403).json({ message: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", payload.email)
      .single();
    if (userError || !user) return res.status(404).json({ message: "User not found" });

    const { data: record, error: recordError } = await supabase
      .from("usersRecords")
      .select("*")
      .eq("id_user", user.id)
      .single();

    if (recordError && recordError.code !== "PGRST116") return res.status(400).json({ message: recordError.message });

    if (!record) {
      const { error: insertError } = await supabase
        .from("usersRecords")
        .insert([{ id_user: user.id, records: [] }]);
      if (insertError) return res.status(400).json({ message: insertError.message });
    }

    const { data: diary, error: diaryError } = await supabase
      .from("usersRecords")
      .select("*")
      .eq("id_user", user.id)
      .order("created_at", { ascending: false });
    if (diaryError) return res.status(400).json({ message: diaryError.message });

    res.status(200).json({ diary });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// ===== SEND DIARY =====
export const sendDiary = async (req, res) => {
  const token = req.cookies.access_token;
  const recordsJSON = req.body.records;
  if (!token) return res.status(403).json({ message: "No token" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", payload.email)
      .single();
    if (userError || !user) return res.status(404).json({ message: "User not found" });

    const { data: existingRecord, error: recordError } = await supabase
      .from("usersRecords")
      .select("*")
      .eq("id_user", user.id)
      .single();
    if (recordError && recordError.code !== "PGRST116") return res.status(400).json({ message: recordError.message });

    if (existingRecord) {
      const { error: updateError } = await supabase
        .from("usersRecords")
        .update({ records: recordsJSON })
        .eq("id_user", user.id);
      if (updateError) return res.status(400).json({ message: updateError.message });
    } else {
      const { error: insertError } = await supabase
        .from("usersRecords")
        .insert([{ id_user: user.id, records: recordsJSON }]);
      if (insertError) return res.status(400).json({ message: insertError.message });
    }

    const { data: diary, error: diaryError } = await supabase
      .from("usersRecords")
      .select("*")
      .eq("id_user", user.id)
      .order("created_at", { ascending: false });
    if (diaryError) return res.status(400).json({ message: diaryError.message });

    res.status(200).json({ diary });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};
