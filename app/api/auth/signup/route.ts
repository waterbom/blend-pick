import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(req: NextRequest) {
  const {
    name,
    email,
    password,
    marketing_agreed,
    sms_agreed,
    email_marketing_agreed,
  } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json(
      { ok: false, error: "모든 항목을 입력해주세요." },
      { status: 400 }
    );
  }

  const existing = await pool.query(
    "SELECT id FROM shop_users WHERE email = $1",
    [email]
  );
  if (existing.rows.length > 0) {
    return NextResponse.json(
      { ok: false, error: "이미 사용 중인 이메일입니다." },
      { status: 400 }
    );
  }

  const password_hash = await bcrypt.hash(password, 10);
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000);
  const userId = crypto.randomUUID();

  await pool.query(
    `INSERT INTO shop_users
      (id, name, email, password_hash, role, is_active, is_verified,
       email_verify_code, email_verify_expires_at,
       marketing_agreed, sms_agreed, email_marketing_agreed)
     VALUES ($1, $2, $3, $4, 'customer', true, false, $5, $6, $7, $8, $9)`,
    [
      userId,
      name,
      email,
      password_hash,
      code,
      expires_at,
      marketing_agreed ?? false,
      sms_agreed ?? false,
      email_marketing_agreed ?? false,
    ]
  );

  await transporter.sendMail({
    from: `"BLEND PICK" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "[BLEND PICK] 이메일 인증 코드",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="font-size:20px">이메일 인증</h2>
        <p>아래 6자리 코드를 입력해주세요. <strong>10분</strong> 내에 입력해야 합니다.</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;padding:24px;background:#f5f5f5;text-align:center;border-radius:8px">
          ${code}
        </div>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
