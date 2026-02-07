import dotenv from "dotenv";
import app from "./app.js";

dotenv.config();
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
app.listen(process.env.PORT, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`);
});
