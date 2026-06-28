const samping = document.getElementById('samping');
const kotakPesan = document.getElementById('kotakPesan');
const inputPesan = document.getElementById('inputPesan');
const daftarRiwayat = document.getElementById('daftarRiwayat');
const formKirim = document.getElementById('formKirim');
let berkasGambar = null, sedangMerekam = false, perekam = null;

function bukaSamping(){ samping.classList.add('buka'); }
function tutupSamping(){ samping.classList.remove('buka'); }

function gantiTema(jenis){
  if(jenis === 'gelap'){
    document.documentElement.classList.add('dark');
    localStorage.setItem('tema', 'gelap');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('tema', 'terang');
  }
}
if(localStorage.getItem('tema') === 'gelap') gantiTema('gelap');

async function muatRiwayat(){
  const res = await fetch('/api/daftar-riwayat');
  const data = await res.json(); daftarRiwayat.innerHTML = '';
  data.forEach(item => {
    const el = document.createElement('div');
    el.className = 'p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border dark:border-gray-700 text-sm transition';
    el.innerText = item.judul.substring(0,25)+'...';
    el.onclick = async () => {
      const baca = await fetch('/api/baca-riwayat/'+item.id);
      const isi = await baca.json();
      if(isi){
        kotakPesan.innerHTML = '';
        tambahPesan('Anda', isi.pesan + (isi.gambar ? ' 📷' : ''));
        tambahPesan('KPACA', isi.jawaban);
      }
    };
    daftarRiwayat.appendChild(el);
  });
}

function obrolanBaru(){ kotakPesan.innerHTML = ''; inputPesan.value = ''; hapusGambar(); tutupSamping(); }

function tambahPesan(dari, teks){
  const bungkus = document.createElement('div');
  bungkus.className = `pesan ${dari==='Anda'?'ml-auto bg-utama text-white':'mr-auto bg-white dark:bg-gray-800 border dark:border-gray-700'} rounded-lg p-3 shadow`;
  bungkus.innerText = teks;
  kotakPesan.appendChild(bungkus);
  kotakPesan.scrollTop = kotakPesan.scrollHeight;
}

function pilihGambar(input){
  if(input.files && input.files[0]){
    berkasGambar = input.files[0];
    const pratinjau = document.getElementById('pratinjauGambar');
    const tampil = document.getElementById('gambarTampil');
    const nama = document.getElementById('namaGambar');
    tampil.src = URL.createObjectURL(berkasGambar);
    nama.innerText = berkasGambar.name;
    pratinjau.classList.remove('hidden');
  }
}
function hapusGambar(){ berkasGambar = null; document.getElementById('inputGambar').value=''; document.getElementById('pratinjauGambar').classList.add('hidden'); }

async function mulaiRekam(){
  if(!sedangMerekam){
    const aliran = await navigator.mediaDevices.getUserMedia({audio:true});
    perekam = new MediaRecorder(aliran); let potongan = [];
    perekam.ondataavailable = e => potongan.push(e.data);
    perekam.onstop = () => {
      const pengenal = new (window.SpeechRecognition||window.webkitSpeechRecognition)();
      pengenal.lang = 'id-ID';
      pengenal.onresult = e => inputPesan.value = e.results[0][0].transcript;
      pengenal.start(); aliran.getTracks().forEach(t=>t.stop());
    };
    perekam.start(); sedangMerekam = true;
    document.getElementById('tombolSuara').classList.add('sedang-merekam');
  } else {
    perekam.stop(); sedangMerekam = false;
    document.getElementById('tombolSuara').classList.remove('sedang-merekam');
  }
}

formKirim.addEventListener('submit', async e => {
  e.preventDefault();
  const teks = inputPesan.value.trim();
  if(!teks && !berkasGambar) return;
  tambahPesan('Anda', teks + (berkasGambar?' 📷 [Gambar Terlampir]':''));
  inputPesan.value = '';
  const dataKirim = new FormData();
  dataKirim.append('pesan', teks);
  if(berkasGambar) dataKirim.append('gambar', berkasGambar);
  const res = await fetch('/api/chat', { method:'POST', body:dataKirim });
  const hasil = await res.json();
  tambahPesan('KPACA', hasil.jawaban);
  await fetch('/api/simpan-riwayat', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      judul: (teks||'Gambar').substring(0,30), pesan:teks,
      gambar: berkasGambar?'ada':null, jawaban: hasil.jawaban
    })
  });
  muatRiwayat(); hapusGambar();
});

muatRiwayat();
