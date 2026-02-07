import { supabase } from "../config/supabase.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

// ===== GET DIARY =====
export const getDiary = async (req, res) => {
  const email = req.user?.email; // req.user приходит из requireAuth middleware
  if (!email) return res.status(403).json({ message: "No user email" });

  try {
    // 1. Находим пользователя
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (userError || !user)
      return res.status(404).json({ message: "User not found" });

    // 2. Получаем запись пользователя
    let { data: record, error: recordError } = await supabase
      .from("usersRecords")
      .select("*")
      .eq("id_user", user.id)
      .single();

    if (recordError && recordError.code !== "PGRST116") {
      return res.status(400).json({ message: recordError.message });
    }

    // 3. Если записи нет — создаём пустую
    if (!record) {
      const { data: newRecord, error: insertError } = await supabase
        .from("usersRecords")
        .insert([{ id_user: user.id, records: [], all_Tags: [], all_Color_Tags: [] }])
        .select("*")
        .single();

      if (insertError) return res.status(400).json({ message: insertError.message });

      record = newRecord;
    }

    res.status(200).json({ diary: record });
  } catch (err) {
    console.error("Get diary error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== SAVE / UPDATE DIARY =====
export const saveDiary = async (req, res) => {
  const email = req.user?.email;
  const recordsJSON = req.body.records; // массив записей
  if (!email) return res.status(403).json({ message: "No user email" });

  try {
    // 1. Находим пользователя
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (userError || !user)
      return res.status(404).json({ message: "User not found" });

    // 2. Проверяем, есть ли запись у пользователя
    const { data: existingRecord, error: recordError } = await supabase
      .from("usersRecords")
      .select("*")
      .eq("id_user", user.id)
      .single();

    if (recordError && recordError.code !== "PGRST116")
      return res.status(400).json({ message: recordError.message });

    // 3. Если запись есть — обновляем, иначе создаём
    if (existingRecord) {
      const { data: updated, error: updateError } = await supabase
        .from("usersRecords")
        .update({ records: recordsJSON })
        .eq("id_user", user.id)
        .select("*")
        .single();

      if (updateError) return res.status(400).json({ message: updateError.message });

      res.status(200).json({ diary: updated });
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("usersRecords")
        .insert([{ id_user: user.id, records: recordsJSON }])
        .select("*")
        .single();

      if (insertError) return res.status(400).json({ message: insertError.message });

      res.status(200).json({ diary: inserted });
    }
  } catch (err) {
    console.error("Save diary error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
