const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const cookieParser = require('cookie-parser');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Kunci API yang baru kamu berikan
const OR_KEY = "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";
const SUPABASE_URL = "https://safwstugkkfpnfbabakw.supabase.co";
const SUPABASE_KEY = "sb_publishable_3MQCz-f8AvoiBOtCfRY0PQ_ASRpiVav";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const unggah = multer({ storage: multer.memoryStorage() });

app.set('trust proxy', 1);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// --- HALAMAN ---
app.get('/', (req, res) => {
  if (req.cookies.user_id) return res.redirect('/chat');
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public/register.html')));

app.get('/chat', async (req, res) => {
  if (!req.cookies.user_id) return res.redirect('/login');
  try {
    const { data } = await supabase.from('users').select('id').eq('id', Number(req.cookies.user_id)).single();
    data ? res.sendFile(path.join(__dirname, 'public/chat.html')) : res.clearCookie('user_id').redirect('/login');
  } catch {
    res.clearCookie('user_id').redirect('/login');
  }
});

// --- PENDAFTARAN ---
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) 
    return res.send('<script>alert("Isi semua kolom!");history.back();</script>');
  try {
    const hash = await bcrypt.hash(password, 10);
    const { error } = await supabase.from('users').insert([{ username, email, password: hash }]);
    if (error) return res.send('<script>alert("Nama atau email sudah terpakai!");history.back();</script>');
    res.redirect('/login');
  } catch {
    res.send('<script>alert("Kesalahan saat mendaftar!");history.back();</script>');
  }
});

// --- MASUK ---
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
    if (error || !user || !await bcrypt.compare(password, user.password)) 
      return res.send('<script>alert("Nama pengguna atau sandi salah!");history.back();</script>');
    res.cookie('user_id', String(user.id), { 
      maxAge: 86400000, secure: true, httpOnly: true, sameSite: 'lax' 
    });
    res.redirect('/chat');
  } catch {
    res.send('<script>alert("Kesalahan saat masuk!");history.back();</script>');
  }
});

// --- RIWAYAT ---
app.post('/api/simpan-riwayat', unggah.none(), async (req, res) => {
  if (!req.cookies.user_id) return res.json({ ok: false });
  try {
    const { judul, pesan, gambar, jawaban } = req.body;
    await supabase.from('riwayat').insert([{ 
      user_id: Number(req.cookies.user_id), judul, pesan, gambar, jawaban 
    }]);
    res.json({ ok: true });
  } catch { res.json({ ok: false }); }
});

app.get('/api/daftar-riwayat', async (req, res) => {
  if (!req.cookies.user_id) return res.json([]);
  const { data } = await supabase.from('riwayat')
    .select('id, judul, dibuat')
    .eq('user_id', Number(req.cookies.user_id))
    .order('dibuat', { ascending: false });
  res.json(data || []);
});

app.get('/api/baca-riwayat/:id', async (req, res) => {
  if (!req.cookies.user_id) return res.json(null);
  const { data } = await supabase.from('riwayat')
    .select('pesan, gambar, jawaban')
    .eq('id', req.params.id)
    .eq('user_id', Number(req.cookies.user_id))
    .single();
  res.json(data || null);
});

// --- PANGGIL AI QWEN ---
app.post('/api/chat', unggah.single('gambar'), async (req, res) => {
  if (!req.cookies.user_id) return res.json({ jawaban: "Silakan masuk dulu!" });

  const teks = req.body.pesan || '';
  let konten = [];

  if (req.file) {
    const base64 = req.file.buffer.toString('base64');
    konten = [
      { type: "text", text: teks || "Jelaskan isi gambar ini dalam Bahasa Indonesia." },
      {
        type: "image_url",
        image_url: { url: `data:${req.file.mimetype};base64,${base64}` }
      }
    ];
  } else {
    konten = [{ type: "text", text: teks }];
  }

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OR_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kpaca-uu.vercel.app",
        "X-Title": "KPACA AI"
      },
      body: JSON.stringify({
        model: "qwen/qwen-vl-plus:free",
        messages: [
          { role: "system", content: "Kamu KPACA AI, jawab dalam Bahasa Indonesia yang santai, jelas, dan sopan." },
          { role: "user", content: konten }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const hasil = await r.json();
    if (hasil.error) throw new Error(hasil.error.message);
    if (!hasil.choices || hasil.choices.length === 0) throw new Error("Tidak ada jawaban dari AI");

    res.json({ jawaban: hasil.choices[0].message.content.trim() });

  } catch (e) { 
    res.json({ jawaban: "Kesalahan: " + e.message }); 
  }
});

app.get('/logout', (req, res) => { res.clearCookie('user_id'); res.redirect('/'); });

// ✅ Wajib ada supaya Vercel berjalan
module.exports = app;

// Hanya berjalan jika dijalankan di komputer sendiri
if (require.main === module) {
  app.listen(PORT, () => console.log("✅ Berjalan di port", PORT));
}
        
