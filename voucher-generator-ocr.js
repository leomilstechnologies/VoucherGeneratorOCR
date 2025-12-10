jQuery(document).ready(function( $ ){
    // =========================================================================
    // I. KONSTANTA DAN DATA
    // =========================================================================
    
    // Character Set (Alphabet) untuk Enkripsi/Dekripsi
    const charcode = "d2ZYIVoe7cjksF9HyXGKOvSPMuNWDqQBlA61xRbC0T5Lg4apwmEzf3triJhUn8";

    // Daftar Institusi yang Terdaftar dan Trigger Code mereka
    const RegisterInstitusi = [
        { 
            name: "Institut PTIQ Jakarta",
            trigger: "MEPPTIQ15"
        }
    ];
    
    // Daftar Voucher (Digunakan untuk tujuan debugging dan simulasi di sisi klien)
    const voucherBundle = {
        "triggers": ["MEPPTIQ15"],
        "coupon": ["MILS15P","MILS40K"]
    }

    // =========================================================================
    // II. FUNGSI HELPER ENKRIPSI & DEKRIPSI (Vigenere Cipher Modular)
    // =========================================================================

    // --- 1. Generator Karakter Acak (untuk Key) ---
    function RandChar(n) {
        if(!n) return '';
        let charkeys = charcode.split('');
        let q = [];
        for (var i = 0; i < n; i++) {
            let r = Math.floor(Math.random() * charkeys.length);
            q.push(charkeys[r]);
        }
        return q.join(''); 
    }

    // --- 2. Enkripsi Voucher (Menghasilkan Alias) ---
    function voucherEncrypt(c) {
        let key = RandChar(3);
        let keymap = key.split('').map((n) => charcode.indexOf(n));
        let code = c.split('').map((char, i) => {
            let k = charcode.indexOf(char); // Posisi karakter asli
            let l = keymap[i % key.length]; // Nilai shift (key)
            
            // Logika Enkripsi: (k + l) % M
            let m = (k + l) % charcode.length;
            return charcode[m];
        });
        
        let encryptedString = code.join('');
        
        // Tambahkan key ke akhir string terenkripsi
        return encryptedString + key;
    }

    // --- 3. Dekripsi Voucher (Untuk proses verifikasi di backend/checkout) ---
    function voucherDecrypt(c) {
        let key = c.slice(-3); // Ekstrak Key
        let crypt = c.slice(0, -3); // Ekstrak Ciphertext
    
        let keymap = key.split('').map((n) => charcode.indexOf(n));
        
        let str = crypt.split('').map((char, i) => {
            let k = charcode.indexOf(char); // Posisi karakter terenkripsi (Cipher)
            let l = keymap[i % key.length]; // Nilai shift (Key)
    
            // Logika Dekripsi: ((k - l) % M + M) % M
            let difference = k - l;
            let m = ((difference % charcode.length) + charcode.length) % charcode.length;
            
            return charcode[m];
        });
    
        return str.join('');
    }
    
    // Fungsi pembungkus utama generator alias
    function VoucherGenerator(c) {
        return voucherEncrypt(c);
    }

    // =========================================================================
    // III. DOM SELECTION DAN KONTROL TAMPILAN
    // =========================================================================
    
    const loadingOverlay = document.querySelector('.overlay-loading');
    const voucherDisplay = document.querySelector('.voucher-display');
    const voucherOutput = document.querySelector('#voucher-output');
    const btnCopyVoucher = document.querySelector('#btn-copy-voucher'); 

    // =========================================================================
    // IV. FUNGSI UTAMA (VALIDATOR & GENERATOR)
    // =========================================================================

    /**
     * Fungsi utama yang menangani proses:
     * 1. Validasi Input Manual
     * 2. Menampilkan Loading Overlay
     * 3. Menjalankan OCR pada file gambar
     * 4. Mencocokkan teks hasil OCR
     * 5. Jika cocok, Generate Alias Voucher dan tampilkan
     */
    async function Validator() { 
        // 1. Ambil input
        let xname = document.querySelector('#username-input').value.trim();
        let xinst = document.querySelector('#institute-input').value.trim();
        const files = document.querySelector('#card-upload').files;
        
        if(!xname || !xinst || files.length === 0) {
            console.log("Mohon lengkapi semua data dan unggah kartu.");
            return;
        }
        
        let file = files[0];
        
        // --- KONTROL LOADING: Tampilkan ---
        loadingOverlay.style.display = 'flex';
        voucherDisplay.style.display = 'none'; // Pastikan voucher display tersembunyi
        
        const reader = new FileReader();

        reader.onload = async function(e) {
            const dataUrl = e.target.result; 
            
            try {
                // Proses OCR
                const { data: { text } } = await Tesseract.recognize(
                    dataUrl,
                    'eng', 
                    { logger: m => console.log('OCR Progress:', m.status, m.progress) }
                );
                
                const extractedText = text;
                console.log("Teks yang diekstrak:", extractedText);

                // Pencocokan Case-Insensitive
                const isNameMatch = extractedText.toLowerCase().includes(xname.toLowerCase());
                const isInstMatch = extractedText.toLowerCase().includes(xinst.toLowerCase());

                if (isNameMatch && isInstMatch) {
                    // Validasi Berhasil: Generate Alias
                    let presetCode = RegisterInstitusi.find((n) => n.name == xinst);
                    
                    if(presetCode) {
                        let trigger = presetCode.trigger;
                        let encryptedAlias = VoucherGenerator(trigger); 
                        
                        // Output berhasil
                        voucherOutput.innerHTML = encryptedAlias;
                        // --- KONTROL VOUCHER: Tampilkan Overlay ---
                        voucherDisplay.style.display = 'flex';
                        console.log(`âœ… Alias Voucher Berhasil Dihasilkan: ${encryptedAlias}`);
                    } else {
                        console.log("âŒ Error: Trigger institusi tidak ditemukan.");
                    }
                
                } else {
                    console.log("âŒ Validasi Gagal: Data yang diekstrak dari gambar tidak cocok dengan input manual.");
                }

            } catch (error) {
                console.error("Error selama proses OCR:", error);
            } finally {
                 // --- KONTROL LOADING: Sembunyikan (Selalu dieksekusi) ---
                loadingOverlay.style.display = 'none';
            }
        };

        reader.onerror = function(e) {
            console.error("Error membaca file:", e.target.error);
            loadingOverlay.style.display = 'none';
        };

        reader.readAsDataURL(file); 
    }

    // =========================================================================
    // V. FUNGSI DEBUGGING
    // =========================================================================

    /**
     * Fungsi Debugging OCRTest (Dipanggil dari tombol debug)
     */
    async function OCRTest() {
        const outputElement = document.querySelector('#ocr-output');
        const files = document.querySelector('#ocr-debug-upload').files;

        outputElement.textContent = "Sedang menunggu gambar...";
        
        if(files.length === 0) {
            outputElement.textContent = "âŒ Pilih file gambar untuk menguji OCR.";
            return;
        }

        let file = files[0];
        
        outputElement.textContent = `Memulai OCR untuk: ${file.name}...\nProses ini mungkin memakan waktu.`;
        loadingOverlay.style.display = 'flex'; // Tampilkan loading

        const reader = new FileReader();

        reader.onload = async function(e) {
            const dataUrl = e.target.result;
            
            try {
                const { data: { text } } = await Tesseract.recognize(
                    dataUrl,
                    'eng', 
                    { logger: m => console.log('OCR Test Progress:', m.status, m.progress) }
                );
                
                outputElement.textContent = "âœ… Teks Berhasil Diekstrak:\n\n" + text;

            } catch (error) {
                outputElement.textContent = `âŒ Error selama proses OCR: ${error.message}`;
                console.error("Error selama proses OCR Test:", error);
            } finally {
                 loadingOverlay.style.display = 'none'; // Sembunyikan loading
            }
        };

        reader.onerror = function(e) {
            outputElement.textContent = `âŒ Error membaca file: ${e.target.error}`;
            console.error("Error membaca file untuk OCR Test:", e.target.error);
            loadingOverlay.style.display = 'none';
        };

        reader.readAsDataURL(file); 
    }
    
    /**
     * Test Mandiri Enkripsi/Dekripsi
     */
    function VoucherGeneratorTest() {
        const originalVoucher = "VOUCHER12345";
        console.log("--- TEST ENKRIPSI/DEKRIPSI ---");
        
        const encryptedAlias = voucherEncrypt(originalVoucher);
        const decryptedVoucher = voucherDecrypt(encryptedAlias);
        
        console.log(`Kode Asli: ${originalVoucher}`);
        console.log(`Kode Terenkripsi: ${encryptedAlias}`);
        console.log(`Hasil Dekripsi: ${decryptedVoucher}`);
        
        if (originalVoucher === decryptedVoucher) {
            console.log("Status: Sukses! Enkripsi dan Dekripsi bekerja dengan benar.");
        } else {
            console.log("Status: Gagal! Hasil dekripsi tidak sama dengan aslinya.");
        }
        console.log("-------------------------------");
    }

    // =========================================================================
    // VI. EVENT LISTENERS
    // =========================================================================

    /**
     * Fungsi untuk menyalin kode voucher ke clipboard
     */
    function copyVoucherCode() {
        const codeToCopy = voucherOutput.textContent;
        
        if (!codeToCopy) {
            console.warn("Tidak ada kode voucher yang dapat disalin.");
            return;
        }

        navigator.clipboard.writeText(codeToCopy)
            .then(() => {
                console.log("Kode voucher berhasil disalin!");
                alert("Kode voucher berhasil disalin: " + codeToCopy); 
                voucherDisplay.style.display = 'none'; // Tutup overlay setelah salin
            })
            .catch(err => {
                console.error('Gagal menyalin kode:', err);
                alert('Gagal menyalin. Silakan salin manual.');
            });
    }

    // Hubungkan Event Listener Utama
    document.querySelector('#btn-validate').addEventListener('click', Validator, false);
    document.querySelector('#btn-ocr-test').addEventListener('click', OCRTest, false);
    btnCopyVoucher.addEventListener('click', copyVoucherCode, false);
    
    // Jalankan test saat skrip dimuat
    //VoucherGeneratorTest(); 
});