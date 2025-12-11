jQuery(document).ready(function( $ ){
    
    // =========================================================================
    // I. KONSTANTA DAN DOM SELECTION
    // =========================================================================
    
    // Catatan: Variabel global ajaxurl dan voucher_ajax_nonce diakses dari PHP.

    const loadingOverlay = document.querySelector('.overlay-loading');
    const voucherDisplay = document.querySelector('.voucher-display');
    const voucherOutput = document.querySelector('#voucher-output');
    const btnCopyVoucher = document.querySelector('#btn-copy-voucher');
    const fileInput = document.querySelector('#card-upload'); // Input file
    
    // Asumsi: Tesseract.js sudah dimuat sebelumnya

    // =========================================================================
    // II. FUNGSI UTAMA (VALIDATOR & GENERATOR AJAX)
    // =========================================================================

    /**
     * Fungsi utama yang menangani proses:
     * 1. Menjalankan OCR pada file gambar (Client-Side)
     * 2. Mengirim teks yang diekstrak ke Backend untuk validasi & enkripsi (AJAX)
     * 3. Menampilkan alias voucher yang dikembalikan dari Server
     */
    async function Validator() { 
        const files = fileInput.files;
        
        let file = files[0];
        
        if (!file) {
            console.warn("Tidak ada file yang dipilih.");
            return;
        }

        // --- KONTROL LOADING: Tampilkan ---
        loadingOverlay.style.display = 'flex';
        voucherDisplay.style.display = 'none'; 
        
        const reader = new FileReader();

        reader.onload = async function(e) {
            const dataUrl = e.target.result; 
            let extractedText = null;
            
            try {
                // 1. Proses OCR
                const { data: { text } } = await Tesseract.recognize(
                    dataUrl,
                    'eng', 
                    { logger: m => console.log('OCR Progress:', m.status, m.progress) }
                );
                
                extractedText = text;
                console.log("Teks yang diekstrak:", extractedText);

                // 2. Kirim Teks ke Backend untuk Validasi dan Generasi Alias
                if (extractedText) {
                    await sendValidationToBackend(extractedText);
                } else {
                    alert("OCR gagal mengekstrak teks. Coba gambar lain.");
                }

            } catch (error) {
                console.error("Error selama proses OCR:", error);
                alert("Terjadi kesalahan teknis saat membaca gambar.");
            } finally {
                // --- KONTROL LOADING: Sembunyikan ---
                loadingOverlay.style.display = 'none';
            }
        };

        reader.onerror = function(e) {
            console.error("Error membaca file:", e.target.error);
            loadingOverlay.style.display = 'none';
        };

        reader.readAsDataURL(file); 
    }

    /**
     * Mengirim teks yang diekstrak ke server WordPress (admin-ajax.php).
     */
    async function sendValidationToBackend(extractedText) {
        
        try {
            const response = await $.ajax({
                url: ajaxurl, // Variabel global yang disuntikkan oleh PHP
                type: 'POST',
                data: {
                    action: 'validate_and_generate_voucher',
                    extracted_text: extractedText
                } 
            });

            if (response.success) {
                // Validasi Berhasil
                const encryptedAlias = response.data.voucher_alias;
                
                voucherOutput.textContent = encryptedAlias;
                voucherDisplay.style.display = 'flex';
                console.log(`✅ Alias Voucher Berhasil Dihasilkan: ${encryptedAlias}`);

            } else {
                // Validasi Gagal (Pesan dari server)
                console.error("Validasi Server Gagal:", response.data.message);
                alert(`Validasi Gagal: ${response.data.message}`);
            }

        } catch (xhr) { // Sudah diperbaiki untuk menangani Promise rejection
            // Mengakses informasi error dari objek XHR yang dilempar
            const errorMessage = xhr.statusText || "Tidak ada respons dari server.";
            console.error("AJAX Error:", errorMessage, xhr);
            alert(`Terjadi kesalahan koneksi saat memvalidasi data: ${errorMessage}.`);
        }
    }

    // =========================================================================
    // III. FUNGSI LAINNYA
    // =========================================================================
    
    // Fungsi pembantu untuk menyalin kode voucher
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

    // =========================================================================
    // IV. EVENT LISTENERS
    // =========================================================================
    
    // Validator dipicu oleh event 'change' pada input file.
    if (fileInput) {
        fileInput.addEventListener('change', Validator, false);
    } else {
        console.error("Input file (#card-upload) tidak ditemukan.");
    }

    if (btnCopyVoucher) {
        btnCopyVoucher.addEventListener('click', copyVoucherCode, false);
    }
	
	async function debugFuckingWordpressAjax(){
		await sendValidationToBackend("Institut PTIQ Jakarta");
	}
	debugFuckingWordpressAjax();
});
