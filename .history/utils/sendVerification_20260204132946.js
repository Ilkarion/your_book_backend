import { client } from "../config/brevo.js";

export const sendVerification = async (email, token) => {

  await client.sendTransacEmail({
    sender: { email: "myfirststepsprogramming@gmail.com", name: "Light" },
    to: [{ email }],
    subject: "Confirm your email",
    htmlContent: `<a href="${process.env.SERVER_URL}/api/confirm?token=${token}">Verify email</a>`,
  });
};
