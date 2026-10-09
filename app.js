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

// Telefon fotoğrafları çok büyük olduğu için kaydetmeden önce küçültülür.
function fotoyuKucult(dosya) {
  return new Promise((resolve) => {
    const adres = URL.createObjectURL(dosya);
    const resim = new Image();
    resim.onload = () => {
      const oran = Math.min(1, 1600 / Math.max(resim.width, resim.height));
      const tuval = document.createElement("canvas");
      tuval.width = Math.round(resim.width * oran);
      tuval.height = Math.round(resim.height * oran);
      tuval.getContext("2d").drawImage(resim, 0, 0, tuval.width, tuval.height);
      URL.revokeObjectURL(adres);
      resolve(tuval.toDataURL("image/jpeg", 0.85));
    };
    resim.onerror = async () => {
      URL.revokeObjectURL(adres);
      resolve(await dosyayiBase64eCevir(dosya));
    };
    resim.src = adres;
  });
}

// Eski kayıtlarda tek fotoğraf "foto" alanında duruyor.
function kayitFotolari(kayit) {
  if (kayit.fotolar) return kayit.fotolar;
  return kayit.foto ? [kayit.foto] : [];
}

function puanliMi(kayit) {
  return kayit.tat != null;
}

function genelPuan(kayit) {
  return (kayit.tat + kayit.doku + kayit.kabariklik) / 3;
}

function puanCubuklari(kayit) {
  const satir = (ad, deger) => `
    <div class="puan-cubuk">
      <span class="puan-ad">${ad}</span>
      <span class="puan-iz"><span class="puan-dolu" style="width:${deger * 10}%"></span></span>
      <span class="puan-sayi">${deger}</span>
    </div>`;
  return `<div class="puan-cubuklari">
    ${satir("Tat", kayit.tat)}${satir("Doku", kayit.doku)}${satir("Kabarıklık", kayit.kabariklik)}
  </div>`;
}

// Hukuk esprisi: her ekmek bir "dosya", numarası yıl/sıra.
function dosyaNo(kayit) {
  return `Dosya No: ${new Date(kayit.tarih).getFullYear()}/${kayit.id}`;
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

// Favoriler de kayıtlar görünümünü kullanır, sadece listeyi süzer.
let sadeceFavoriler = false;

function sekmeyeGec(hedef, favori = false) {
  sadeceFavoriler = favori;
  document.querySelectorAll(".sekme-buton").forEach((b) => {
    const eslesti = b.dataset.hedef === hedef && (b.dataset.favori === "1") === favori;
    b.classList.toggle("aktif", eslesti);
  });
  document.querySelectorAll(".gorunum").forEach((g) => g.classList.add("gizli"));
  document.getElementById(hedef).classList.remove("gizli");
  window.scrollTo(0, 0);
  if (hedef === "gorunum-kayitlar") listeyiYenile();
}

document.querySelectorAll(".sekme-buton").forEach((buton) => {
  buton.addEventListener("click", () => {
    // düzenleme yarıda bırakılıp sekme değiştirilirse form boş haline döner
    if (duzenlenenKayit) formuSifirla();
    sekmeyeGec(buton.dataset.hedef, buton.dataset.favori === "1");
  });
});

function kayitlarSekmesineGec() {
  sekmeyeGec("gorunum-kayitlar");
}

// ---- Malzeme (un) satırları ----

const malzemeSatirlariKapsayici = document.getElementById("malzeme-satirlari");
const malzemeSablonu = document.getElementById("malzeme-satiri-sablonu");

function malzemeSatiriEkle(malzeme) {
  const parca = malzemeSablonu.content.cloneNode(true);
  const satir = parca.querySelector(".malzeme-satiri");
  const unSecim = satir.querySelector(".malzeme-un");
  const digerAd = satir.querySelector(".malzeme-diger-ad");
  const silButon = satir.querySelector(".malzeme-sil-buton");

  // düzenlemede satır kayıttaki değerlerle dolu gelir
  if (malzeme && malzeme.un) {
    unSecim.value = malzeme.un;
    satir.querySelector(".malzeme-gram").value = malzeme.gram;
    if (malzeme.un === "diger") {
      digerAd.value = malzeme.ad;
      digerAd.classList.remove("gizli");
    }
  }

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

document.getElementById("malzeme-ekle-buton").addEventListener("click", () => malzemeSatiriEkle());

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
const formBaslik = document.getElementById("form-baslik");
const kaydetButon = document.getElementById("kaydet-buton");
const vazgecButon = document.getElementById("vazgec-buton");
const puanVer = document.getElementById("puan-ver");
const puanlarKutusu = document.getElementById("puanlar");
const puanBekliyorNot = document.getElementById("puan-bekliyor-not");
const fotoAlanlari = [...document.querySelectorAll(".foto-alani")];
const PUAN_ALANLARI = ["tat", "doku", "kabariklik"];

// Düzenleme sırasında üzerinde çalışılan kayıt; yeni kayıt eklerken null.
let duzenlenenKayit = null;
// Formdaki iki fotoğraf yuvası (yoksa null).
let formFotolari = [null, null];

PUAN_ALANLARI.forEach((id) => {
  const kaydirici = document.getElementById(id);
  const gosterge = document.getElementById(id + "-deger");
  kaydirici.addEventListener("input", () => {
    gosterge.textContent = kaydirici.value;
  });
});

function puanAlaniniGuncelle() {
  puanlarKutusu.classList.toggle("gizli", !puanVer.checked);
  puanBekliyorNot.classList.toggle("gizli", puanVer.checked);
}

puanVer.addEventListener("change", puanAlaniniGuncelle);

function fotoOnizlemeleriniGuncelle() {
  fotoAlanlari.forEach((alan, i) => {
    const onizleme = alan.querySelector(".foto-onizleme");
    const varMi = Boolean(formFotolari[i]);
    if (varMi) onizleme.src = formFotolari[i];
    onizleme.classList.toggle("gizli", !varMi);
    alan.querySelector(".foto-kaldir").classList.toggle("gizli", !varMi);
  });
}

fotoAlanlari.forEach((alan, i) => {
  const girdi = alan.querySelector(".foto-input");
  girdi.addEventListener("change", async () => {
    const dosya = girdi.files[0];
    if (!dosya) return;
    formFotolari[i] = await fotoyuKucult(dosya);
    fotoOnizlemeleriniGuncelle();
  });
  alan.querySelector(".foto-kaldir").addEventListener("click", () => {
    formFotolari[i] = null;
    girdi.value = "";
    fotoOnizlemeleriniGuncelle();
  });
});

function formuSifirla() {
  duzenlenenKayit = null;
  form.reset();
  malzemeSatirlariKapsayici.innerHTML = "";
  malzemeSatiriEkle();
  PUAN_ALANLARI.forEach((id) => {
    document.getElementById(id + "-deger").textContent = "7";
  });
  formFotolari = [null, null];
  fotoOnizlemeleriniGuncelle();
  puanAlaniniGuncelle();
  formBaslik.textContent = "Yeni Ekmek Ekle";
  kaydetButon.textContent = "Kaydet";
  vazgecButon.classList.add("gizli");
}

function duzenlemeyiBaslat(kayit) {
  formuSifirla();
  duzenlenenKayit = kayit;

  if (kayit.malzemeler && kayit.malzemeler.length > 0) {
    malzemeSatirlariKapsayici.innerHTML = "";
    kayit.malzemeler.forEach((m) => malzemeSatiriEkle(m));
  }

  puanVer.checked = puanliMi(kayit);
  if (puanliMi(kayit)) {
    PUAN_ALANLARI.forEach((id) => {
      document.getElementById(id).value = kayit[id];
      document.getElementById(id + "-deger").textContent = kayit[id];
    });
  }
  puanAlaniniGuncelle();

  document.getElementById("not").value = kayit.not || "";

  const fotolar = kayitFotolari(kayit);
  formFotolari = [fotolar[0] || null, fotolar[1] || null];
  fotoOnizlemeleriniGuncelle();

  formBaslik.textContent = "Kaydı Düzenle";
  kaydetButon.textContent = "Değişiklikleri kaydet";
  vazgecButon.classList.remove("gizli");

  detayPanel.classList.add("gizli");
  sekmeyeGec("gorunum-ekle");
  window.scrollTo(0, 0);
}

vazgecButon.addEventListener("click", () => {
  formuSifirla();
  kayitlarSekmesineGec();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const malzemeler = malzemeSatirlariniOku();
  if (malzemeler.length === 0) {
    alert("Delil yetersiz! En az bir un ekleyip gram gir.");
    return;
  }

  const besin = besinDegerleriniHesapla(malzemeler);
  const puanVar = puanVer.checked;

  // düzenlemede id, tarih ve favori aynen korunur
  const kayit = {
    ...(duzenlenenKayit || { tarih: new Date().toISOString(), favori: false }),
    malzemeler,
    kalori: besin.kalori,
    protein: besin.protein,
    karbonhidrat: besin.karbonhidrat,
    yag: besin.yag,
    bilinmeyenVar: besin.bilinmeyenVar,
    tat: puanVar ? Number(document.getElementById("tat").value) : null,
    doku: puanVar ? Number(document.getElementById("doku").value) : null,
    kabariklik: puanVar ? Number(document.getElementById("kabariklik").value) : null,
    not: document.getElementById("not").value.trim(),
    fotolar: formFotolari.filter(Boolean),
  };
  delete kayit.foto;

  if (duzenlenenKayit) {
    await kayitGuncelle(kayit);
  } else {
    await kayitEkle(kayit);
  }

  formuSifirla();

  kayitlarSekmesineGec();
});

// başlangıçta form boş ve bir malzeme satırıyla açılsın
formuSifirla();

// ---- Liste ----

const listeElemani = document.getElementById("liste");

async function listeyiYenile() {
  const tumKayitlar = await tumKayitlariGetir();
  tumKayitlar.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

  ozetiGuncelle(tumKayitlar);

  const kayitlar = sadeceFavoriler ? tumKayitlar.filter((k) => k.favori) : tumKayitlar;
  document.getElementById("ozet-bolumu").classList.toggle("gizli", sadeceFavoriler);
  document.getElementById("liste-baslik").textContent = sadeceFavoriler ? "Favoriler" : "Kayıtlar";

  if (kayitlar.length === 0) {
    listeElemani.innerHTML = sadeceFavoriler
      ? '<p class="bos-mesaj">Henüz favori yok. Beğendiğin ekmeğin yıldızına dokun.</p>'
      : '<p class="bos-mesaj">Henüz kayıt yok. Alttaki + ile ilk ekmeğini ekle!</p>';
    return;
  }

  listeElemani.innerHTML = "";
  kayitlar.forEach((kayit) => {
    const fotolar = kayitFotolari(kayit);
    const kart = document.createElement("div");
    kart.className = "ekmek-karti";
    kart.innerHTML = `
      <div class="kart-foto ${fotolar.length > 0 ? "" : "fotosuz"}">
        ${fotolar.length > 0 ? `<img src="${fotolar[0]}" alt="">` : `<span class="foto-yok">🍞</span>`}
        ${fotolar.length > 1 ? `<span class="foto-sayisi">2 fotoğraf</span>` : ""}
        <button class="yildiz-buton" title="Favori">${kayit.favori ? "★" : "☆"}</button>
      </div>
      <div class="karti-bilgi">
        <span class="dosya-no">${dosyaNo(kayit)}</span>
        <div class="kart-ust">
          <span class="tarih">${tarihFormatla(kayit.tarih)}</span>
          ${kayit.kalori != null ? `<span class="kalori">${kayit.bilinmeyenVar ? "~" : ""}${kayit.kalori} kcal</span>` : ""}
        </div>
        <span class="unlar-ozet">${malzemeOzeti(kayit)}</span>
        ${puanliMi(kayit) ? puanCubuklari(kayit) : `<span class="puan-bekliyor">⚖️ Karar bekleniyor</span>`}
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

  // henüz puanlanmamış kayıtlar ortalamaya ve "en iyi"ye katılmaz
  const puanlilar = kayitlar.filter(puanliMi);
  const ortalamaPuan = puanlilar.length > 0
    ? (puanlilar.reduce((acc, k) => acc + genelPuan(k), 0) / puanlilar.length).toFixed(1)
    : "–";

  const enIyi = puanlilar.reduce(
    (iyi, k) => (!iyi || genelPuan(k) > genelPuan(iyi) ? k : iyi),
    null
  );

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
      <span class="ozet-sayi">${enIyi ? genelPuan(enIyi).toFixed(1) : "–"}</span>
      <span class="ozet-etiket">En iyi puan</span>
    </div>
    <div class="ozet-oge genis">
      <span class="ozet-etiket">⚖️ Emsal karar (en iyi ekmek)</span><br>
      <span>${enIyi ? `${tarihFormatla(enIyi.tarih)} — ${malzemeOzeti(enIyi)}` : "Henüz puanlanmış ekmek yok"}</span>
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
    <div class="detay-fotolar">${kayitFotolari(kayit).map((f) => `<img src="${f}" alt="">`).join("")}</div>
    <div class="detay-satir">
      <div class="detay-baslik">Tarih</div>
      <div>${tarihFormatla(kayit.tarih)} · ${dosyaNo(kayit)}</div>
    </div>
    <div class="detay-satir">
      <div class="detay-baslik">Unlar</div>
      <div>${malzemeOzeti(kayit)}</div>
    </div>
    ${besinSatiri}
    <div class="detay-satir">
      <div class="detay-baslik">Puanlar</div>
      ${puanliMi(kayit)
        ? puanCubuklari(kayit)
        : "<div>Henüz puanlanmadı — Düzenle'ye basıp verebilirsin.</div>"}
    </div>
    ${kayit.not ? `
    <div class="detay-satir">
      <div class="detay-baslik">Gerekçe (not)</div>
      <div>${kayit.not}</div>
    </div>` : ""}
    <button id="duzenle-buton" class="genis-buton">Düzenle (fotoğraf, puan, not ekle)</button>
    <button id="sil-buton" class="tehlike-buton genis-buton">Bu kaydı sil</button>
  `;
  document.getElementById("duzenle-buton").addEventListener("click", () => duzenlemeyiBaslat(kayit));
  document.getElementById("detay-yildiz").addEventListener("click", async () => {
    kayit.favori = !kayit.favori;
    await kayitGuncelle(kayit);
    detayGoster(kayit);
    listeyiYenile();
  });
  document.getElementById("sil-buton").addEventListener("click", async () => {
    if (confirm("Bu dosya kapatılıp silinsin mi? Temyizi yok!")) {
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
