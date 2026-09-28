// ---- Basit veritabanı (IndexedDB) ----
// Fotoğraflar dahil tüm kayıtlar bu tarayıcıda, bu cihazda saklanır.

const DB_ADI = "ekmekGunluguDB";
const DEPO_ADI = "kayitlar";

function dbAc() {
  return new Promise((resolve, reject) => {
    const istek = indexedDB.open(DB_ADI, 1);
    istek.onupgradeneeded = () => {
      const db = istek.result;
      if (!db.objectStoreNames.contains(DEPO_ADI)) {
        db.createObjectStore(DEPO_ADI, { keyPath: "id", autoIncrement: true });
      }
    };
    istek.onsuccess = () => resolve(istek.result);
    istek.onerror = () => reject(istek.error);
  });
}

async function kayitEkle(kayit) {
  const db = await dbAc();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEPO_ADI, "readwrite");
    tx.objectStore(DEPO_ADI).add(kayit);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function tumKayitlariGetir() {
  const db = await dbAc();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEPO_ADI, "readonly");
    const istek = tx.objectStore(DEPO_ADI).getAll();
    istek.onsuccess = () => resolve(istek.result);
    istek.onerror = () => reject(istek.error);
  });
}

async function kayitGuncelle(kayit) {
  const db = await dbAc();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEPO_ADI, "readwrite");
    tx.objectStore(DEPO_ADI).put(kayit);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function kayitSil(id) {
  const db = await dbAc();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEPO_ADI, "readwrite");
    tx.objectStore(DEPO_ADI).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Un besin değerleri (100 gram için, yaklaşık ortalama değerler) ----

const BESIN_TABLOSU = {
  karabugday: { isim: "Karabuğday unu", kalori: 335, protein: 8.9,  karbonhidrat: 75.0, yag: 2.5 },
  sorgun:     { isim: "Sorgun unu",     kalori: 359, protein: 8.4,  karbonhidrat: 76.6, yag: 3.3 },
  pirinc:     { isim: "Pirinç unu",     kalori: 366, protein: 6.0,  karbonhidrat: 80.1, yag: 1.4 },
  misir:      { isim: "Mısır unu",      kalori: 356, protein: 5.4,  karbonhidrat: 72.9, yag: 3.7 },
  schar:      { isim: "Schar glutensiz un", kalori: 356, protein: 1.5, karbonhidrat: 85.0, yag: 0.5 },
};

// ---- Yardımcılar ----

function dosyayiBase64eCevir(dosya) {
  return new Promise((resolve, reject) => {
    if (!dosya) { resolve(null); return; }
    const okuyucu = new FileReader();
    okuyucu.onload = () => resolve(okuyucu.result);
    okuyucu.onerror = reject;
    okuyucu.readAsDataURL(dosya);
  });
}

function tarihFormatla(isoTarih) {
  const d = new Date(isoTarih);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function malzemeOzeti(kayit) {
  if (kayit.malzemeler && kayit.malzemeler.length > 0) {
    return kayit.malzemeler.map((m) => `${m.ad} ${m.gram}g`).join(", ");
  }
  return kayit.unlar || "";
}

// ---- Sekmeler ----

document.querySelectorAll(".sekme-buton").forEach((buton) => {
  buton.addEventListener("click", () => {
    document.querySelectorAll(".sekme-buton").forEach((b) => b.classList.remove("aktif"));
    document.querySelectorAll(".gorunum").forEach((g) => g.classList.add("gizli"));
    buton.classList.add("aktif");
    document.getElementById(buton.dataset.hedef).classList.remove("gizli");
  });
});

function kayitlarSekmesineGec() {
  document.querySelectorAll(".sekme-buton").forEach((b) => b.classList.remove("aktif"));
  document.querySelectorAll(".gorunum").forEach((g) => g.classList.add("gizli"));
  document.querySelector('.sekme-buton[data-hedef="gorunum-kayitlar"]').classList.add("aktif");
  document.getElementById("gorunum-kayitlar").classList.remove("gizli");
}

// ---- Malzeme (un) satırları ----

const malzemeSatirlariKapsayici = document.getElementById("malzeme-satirlari");
const malzemeSablonu = document.getElementById("malzeme-satiri-sablonu");

function malzemeSatiriEkle() {
  const parca = malzemeSablonu.content.cloneNode(true);
  const satir = parca.querySelector(".malzeme-satiri");
  const unSecim = satir.querySelector(".malzeme-un");
  const digerAd = satir.querySelector(".malzeme-diger-ad");
  const silButon = satir.querySelector(".malzeme-sil-buton");

  unSecim.addEventListener("change", () => {
    digerAd.classList.toggle("gizli", unSecim.value !== "diger");
  });

  silButon.addEventListener("click", () => {
    // en az bir satır kalsın
    if (malzemeSatirlariKapsayici.children.length > 1) {
      satir.remove();
    }
  });

  malzemeSatirlariKapsayici.appendChild(satir);
}

document.getElementById("malzeme-ekle-buton").addEventListener("click", malzemeSatiriEkle);

function malzemeSatirlariniOku() {
  const satirlar = [...malzemeSatirlariKapsayici.querySelectorAll(".malzeme-satiri")];
  const malzemeler = [];

  satirlar.forEach((satir) => {
    const unKodu = satir.querySelector(".malzeme-un").value;
    const gram = Number(satir.querySelector(".malzeme-gram").value) || 0;
    if (gram <= 0) return;

    if (unKodu === "diger") {
      const ad = satir.querySelector(".malzeme-diger-ad").value.trim() || "Diğer un";
      malzemeler.push({ un: "diger", ad, gram });
    } else {
      malzemeler.push({ un: unKodu, ad: BESIN_TABLOSU[unKodu].isim, gram });
    }
  });

  return malzemeler;
}

function besinDegerleriniHesapla(malzemeler) {
  const toplam = { kalori: 0, protein: 0, karbonhidrat: 0, yag: 0 };
  let bilinmeyenVar = false;

  malzemeler.forEach((m) => {
    const veri = BESIN_TABLOSU[m.un];
    if (!veri) {
      bilinmeyenVar = true;
      return;
    }
    const oran = m.gram / 100;
    toplam.kalori += veri.kalori * oran;
    toplam.protein += veri.protein * oran;
    toplam.karbonhidrat += veri.karbonhidrat * oran;
    toplam.yag += veri.yag * oran;
  });

  return {
    kalori: Math.round(toplam.kalori),
    protein: Math.round(toplam.protein * 10) / 10,
    karbonhidrat: Math.round(toplam.karbonhidrat * 10) / 10,
    yag: Math.round(toplam.yag * 10) / 10,
    bilinmeyenVar,
  };
}

// ---- Form ----

const form = document.getElementById("ekmek-form");
const fotoInput = document.getElementById("foto");
const fotoOnizleme = document.getElementById("foto-onizleme");

["tat", "doku", "kabariklik"].forEach((id) => {
  const kaydirici = document.getElementById(id);
  const gosterge = document.getElementById(id + "-deger");
  kaydirici.addEventListener("input", () => {
    gosterge.textContent = kaydirici.value;
  });
});

fotoInput.addEventListener("change", async () => {
  const dosya = fotoInput.files[0];
  if (!dosya) {
    fotoOnizleme.classList.add("gizli");
    return;
  }
  fotoOnizleme.src = await dosyayiBase64eCevir(dosya);
  fotoOnizleme.classList.remove("gizli");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const malzemeler = malzemeSatirlariniOku();
  if (malzemeler.length === 0) {
    alert("En az bir un ekleyip gram gir.");
    return;
  }

  const dosya = fotoInput.files[0];
  const foto = await dosyayiBase64eCevir(dosya);
  const besin = besinDegerleriniHesapla(malzemeler);

  const kayit = {
    tarih: new Date().toISOString(),
    malzemeler,
    kalori: besin.kalori,
    protein: besin.protein,
    karbonhidrat: besin.karbonhidrat,
    yag: besin.yag,
    bilinmeyenVar: besin.bilinmeyenVar,
    tat: Number(document.getElementById("tat").value),
    doku: Number(document.getElementById("doku").value),
    kabariklik: Number(document.getElementById("kabariklik").value),
    not: document.getElementById("not").value.trim(),
    foto: foto,
    favori: false,
  };

  await kayitEkle(kayit);

  form.reset();
  malzemeSatirlariKapsayici.innerHTML = "";
  malzemeSatiriEkle();
  ["tat", "doku", "kabariklik"].forEach((id) => {
    document.getElementById(id + "-deger").textContent = "7";
  });
  fotoOnizleme.classList.add("gizli");

  await listeyiYenile();
  kayitlarSekmesineGec();
});

// başlangıçta bir tane boş malzeme satırı olsun
malzemeSatiriEkle();

// ---- Liste ----

const listeElemani = document.getElementById("liste");

async function listeyiYenile() {
  const kayitlar = await tumKayitlariGetir();
  kayitlar.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

  ozetiGuncelle(kayitlar);

  if (kayitlar.length === 0) {
    listeElemani.innerHTML = '<p class="bos-mesaj">Henüz kayıt yok. İlk ekmeğini ekle!</p>';
    return;
  }

  listeElemani.innerHTML = "";
  kayitlar.forEach((kayit) => {
    const kart = document.createElement("div");
    kart.className = "ekmek-karti";
    kart.innerHTML = `
      <button class="yildiz-buton" title="Favori">${kayit.favori ? "★" : "☆"}</button>
      <img src="${kayit.foto || ""}" alt="">
      <div class="karti-bilgi">
        <span class="tarih">${tarihFormatla(kayit.tarih)}</span>
        <span class="unlar-ozet">${malzemeOzeti(kayit)}</span>
        <span class="puan-rozetleri">
          <span>Tat ${kayit.tat}</span>
          <span>Doku ${kayit.doku}</span>
          <span>Kabarık ${kayit.kabariklik}</span>
          ${kayit.kalori != null ? `<span>${kayit.bilinmeyenVar ? "~" : ""}${kayit.kalori} kcal</span>` : ""}
        </span>
      </div>
    `;
    kart.addEventListener("click", () => detayGoster(kayit));
    kart.querySelector(".yildiz-buton").addEventListener("click", async (e) => {
      e.stopPropagation();
      kayit.favori = !kayit.favori;
      await kayitGuncelle(kayit);
      listeyiYenile();
    });
    listeElemani.appendChild(kart);
  });
}

// ---- Özet ----

const ozetElemani = document.getElementById("ozet");

function ozetiGuncelle(kayitlar) {
  if (kayitlar.length === 0) {
    ozetElemani.innerHTML = '<p class="bos-mesaj">Kayıt eklendikçe burada özet görünecek.</p>';
    return;
  }

  const toplam = kayitlar.length;
  const favoriSayisi = kayitlar.filter((k) => k.favori).length;

  const genelPuanToplam = kayitlar.reduce(
    (acc, k) => acc + (k.tat + k.doku + k.kabariklik) / 3,
    0
  );
  const ortalamaPuan = (genelPuanToplam / toplam).toFixed(1);

  const enIyi = kayitlar.reduce((iyi, k) => {
    const puan = (k.tat + k.doku + k.kabariklik) / 3;
    const iyiPuan = (iyi.tat + iyi.doku + iyi.kabariklik) / 3;
    return puan > iyiPuan ? k : iyi;
  }, kayitlar[0]);

  ozetElemani.innerHTML = `
    <div class="ozet-oge">
      <span class="ozet-sayi">${toplam}</span>
      <span class="ozet-etiket">Toplam ekmek</span>
    </div>
    <div class="ozet-oge">
      <span class="ozet-sayi">${ortalamaPuan}</span>
      <span class="ozet-etiket">Ortalama puan</span>
    </div>
    <div class="ozet-oge">
      <span class="ozet-sayi">${favoriSayisi}</span>
      <span class="ozet-etiket">Favori</span>
    </div>
    <div class="ozet-oge">
      <span class="ozet-sayi">${((enIyi.tat + enIyi.doku + enIyi.kabariklik) / 3).toFixed(1)}</span>
      <span class="ozet-etiket">En iyi puan</span>
    </div>
    <div class="ozet-oge genis">
      <span class="ozet-etiket">En iyi ekmek</span><br>
      <span>${tarihFormatla(enIyi.tarih)} — ${malzemeOzeti(enIyi)}</span>
    </div>
  `;
}

// ---- Detay paneli ----

const detayPanel = document.getElementById("detay-panel");
const detayGovde = document.getElementById("detay-govde");
const detayKapat = document.getElementById("detay-kapat");

function detayGoster(kayit) {
  const besinSatiri = kayit.kalori != null ? `
    <div class="detay-satir">
      <div class="detay-baslik">Besin değerleri (yaklaşık)${kayit.bilinmeyenVar ? " — bazı malzemeler hesaba katılmadı" : ""}</div>
      <table class="besin-tablosu">
        <tr><td>Kalori</td><td>${kayit.kalori} kcal</td></tr>
        <tr><td>Protein</td><td>${kayit.protein} g</td></tr>
        <tr><td>Karbonhidrat</td><td>${kayit.karbonhidrat} g</td></tr>
        <tr><td>Yağ</td><td>${kayit.yag} g</td></tr>
      </table>
    </div>` : "";

  detayGovde.innerHTML = `
    <button id="detay-yildiz" class="yildiz-buton detay-yildiz">${kayit.favori ? "★ Favori" : "☆ Favorilere ekle"}</button>
    ${kayit.foto ? `<img src="${kayit.foto}" alt="">` : ""}
    <div class="detay-satir">
      <div class="detay-baslik">Tarih</div>
      <div>${tarihFormatla(kayit.tarih)}</div>
    </div>
    <div class="detay-satir">
      <div class="detay-baslik">Unlar</div>
      <div>${malzemeOzeti(kayit)}</div>
    </div>
    ${besinSatiri}
    <div class="detay-satir">
      <div class="detay-baslik">Puanlar</div>
      <div>Tat: ${kayit.tat}/10 · Doku: ${kayit.doku}/10 · Kabarıklık: ${kayit.kabariklik}/10</div>
    </div>
    ${kayit.not ? `
    <div class="detay-satir">
      <div class="detay-baslik">Not</div>
      <div>${kayit.not}</div>
    </div>` : ""}
    <button id="sil-buton" style="background:#b3452f; margin-top: 10px;">Bu kaydı sil</button>
  `;
  document.getElementById("detay-yildiz").addEventListener("click", async () => {
    kayit.favori = !kayit.favori;
    await kayitGuncelle(kayit);
    detayGoster(kayit);
    listeyiYenile();
  });
  document.getElementById("sil-buton").addEventListener("click", async () => {
    if (confirm("Bu kaydı silmek istediğine emin misin?")) {
      await kayitSil(kayit.id);
      detayPanel.classList.add("gizli");
      listeyiYenile();
    }
  });
  detayPanel.classList.remove("gizli");
}

detayKapat.addEventListener("click", () => detayPanel.classList.add("gizli"));
detayPanel.addEventListener("click", (e) => {
  if (e.target === detayPanel) detayPanel.classList.add("gizli");
});

// ---- Başlangıç ----
listeyiYenile();
