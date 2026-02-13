jQuery(document).ready(function( $ ){
    
    // =========================================================================
    // I. KONFIGURASI API & TEMPLATE KARTU
    // =========================================================================
    
    const GEMINI_API_KEY = 'AIzaSyB6nWXBa0ENRHFK1eq6Ja_USArpcllTPE4';

    // Definisi Area: x,y,w,h dalam persentase (0.0 - 1.0)
    const CARD_TEMPLATES = [
        {
            id: 'UNPAD',
            name: 'Kartu Unpad',
            keywords: ['padjadjaran', 'unpad', 'alumni', 'benefit'], 
            zones: [
                { label: 'logo', type: 'logo', x: 0.0, y: 0.0, w: 0.30, h: 0.25 },
                { label: 'identitas', type: 'text', required: true, x: 0.03, y: 0.25, w: 0.60, h: 0.25 },
                { label: 'qris', type: 'qr', required: true, x: 0.05, y: 0.50, w: 0.25, h: 0.35 },
                { label: 'foto', type: 'photo', x: 0.65, y: 0.25, w: 0.30, h: 0.55 },
                { label: 'side_label', type: 'text', x: 0.90, y: 0.0, w: 0.10, h: 1.0 } 
            ]
        },
        {
            id: 'MAHABODHI_SCHOOL',
            name: 'Mahabodhi Vidya School',
            keywords: ['mahabodhi', 'vidya', 'school'],
            zones: [
                { label: 'header', type: 'text', required: true, x: 0.0, y: 0.0, w: 1.0, h: 0.25 },
                { label: 'identitas', type: 'text', required: true, x: 0.0, y: 0.65, w: 1.0, h: 0.35 },
                { label: 'foto', type: 'photo', x: 0.0, y: 0.25, w: 1.0, h: 0.40 }
            ]
        },
		{
            id: 'Widya Mandala',
            name: 'Kartu UKWMS',
            keywords: ['widya', 'mandala', 'ukwms', 'wemates'], 
            zones: [
                { label: 'side_label', type: 'text', x: 0.0, y: 0.0, w: 1.0, h: 1.0 } 
            ]
        }
    ];

    // =========================================================================
    // II. UI SELECTION
    // =========================================================================
    
    const fieldOverlay = document.querySelector('.overlay-fixed');
    const loadingOverlay = document.querySelector('.overlay-loading');
    const voucherDisplay = document.querySelector('.voucher-display');
    const voucherOutput = document.querySelector('#voucher-output');
    const btnCopyVoucher = document.querySelector('#btn-copy-voucher');
    const fileInput = document.querySelector('#card-upload'); 

    // =========================================================================
    // III. SMART OCR ENGINE (AUTO-DETECT MODEL)
    // =========================================================================
    
    class SmartOCREngine {
        constructor() {
            this.apiKey = GEMINI_API_KEY;
            this.cachedModelUrl = null; // Menyimpan URL model yang valid
        }

        async process(imageFile) {
            // 1. Preprocessing
            const processed = await this._preprocessImage(imageFile);
            
            // 2. Scan QR
            const qrResult = this._scanQR(processed);

            // 3. Tesseract OCR
            const tesseractResult = await Tesseract.recognize(
                processed.blob, 
                'eng', 
                { logger: m => console.log('OCR Progress:', parseInt(m.progress * 100) + '%') }
            );

            // 4. Identifikasi & Filter Zona
            const extraction = this._validateAndExtract(
                tesseractResult.data, 
                qrResult, 
                processed.width, 
                processed.height
            );

            console.log(`[Engine] Template: ${extraction.templateName}`);
            
            if (!extraction.isValid) {
                throw new Error(`Struktur kartu tidak sesuai dengan pola ${extraction.templateName}.`);
            }

            if (!extraction.finalText.trim() || extraction.finalText.length < 5) {
                throw new Error("Teks tidak terbaca jelas.");
            }

            // 5. Gemini AI Cleaning (Dengan Auto-Detect Model)
            const cleanedText = await this._refineWithAI(extraction.finalText);
			console.log(cleanedText, extraction);
            return cleanedText;
        }

        async _preprocessImage(imageFile) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const scaleFactor = 2; 
                    canvas.width = img.naturalWidth * scaleFactor;
                    canvas.height = img.naturalHeight * scaleFactor;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        let gray = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
                        gray = (gray > 140) ? 255 : 0; 
                        data[i] = data[i+1] = data[i+2] = gray;
                    }
                    ctx.putImageData(imageData, 0, 0);
                    canvas.toBlob((blob) => resolve({ blob, imageData, width: canvas.width, height: canvas.height }), 'image/jpeg', 0.95);
                };
                img.onerror = reject;
                img.src = URL.createObjectURL(imageFile);
            });
        }

        _scanQR(processed) {
            if (typeof jsQR === 'undefined') return null;
            const code = jsQR(processed.imageData.data, processed.width, processed.height);
            if (code) {
                return {
                    data: code.data,
                    x: code.location.topLeftCorner.x,
                    y: code.location.topLeftCorner.y
                };
            }
            return null;
        }

        _validateAndExtract(tesseractData, qrData, w, h) {
            const fullText = tesseractData.text.toLowerCase();
            let template = CARD_TEMPLATES.find(t => t.keywords.some(k => fullText.includes(k)));
            if (!template) template = CARD_TEMPLATES.find(t => t.id === 'GENERIC');

            let combinedText = "";
            let isValidStructure = true;

            template.zones.forEach(zone => {
                if (zone.type === 'qr' && zone.required) {
                    if (!qrData) isValidStructure = false; 
                }

                if (zone.type === 'text') {
                    tesseractData.lines.forEach(line => {
                        const xPct = line.bbox.x0 / w;
                        const yPct = line.bbox.y0 / h;
                        if (xPct >= zone.x && xPct <= (zone.x + zone.w) &&
                            yPct >= zone.y && yPct <= (zone.y + zone.h)) {
                            combinedText += line.text + "\n";
                        }
                    });
                }
            });

            return { 
                templateName: template.name, 
                isValid: isValidStructure,
                finalText: combinedText 
            };
        }

        // --- FITUR UTAMA: AUTO DETECT MODEL ---
        async _getModelUrl() {
            // Jika sudah pernah cari model, pakai yang ada di cache
            if (this.cachedModelUrl) return this.cachedModelUrl;

            try {
                // 1. Minta daftar model yang tersedia ke Google
                const listReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
                const listData = await listReq.json();
                
                if (!listData.models) throw new Error("Tidak ada model ditemukan.");

                // 2. Filter model yang support 'generateContent'
                const validModels = listData.models.filter(m => 
                    m.supportedGenerationMethods && 
                    m.supportedGenerationMethods.includes("generateContent")
                );

                // 3. Pilih prioritas: Flash -> Pro -> Sembarang
                let chosenModel = validModels.find(m => m.name.includes("gemini-1.5-flash"));
                if (!chosenModel) chosenModel = validModels.find(m => m.name.includes("gemini-pro"));
                if (!chosenModel) chosenModel = validModels[0]; // Ambil apa saja yang ada

                if (!chosenModel) throw new Error("Tidak ada model Generative AI yang aktif.");

                // 4. Simpan URL-nya
                console.log(`[AI] Model terpilih: ${chosenModel.name}`);
                this.cachedModelUrl = `https://generativelanguage.googleapis.com/v1beta/${chosenModel.name}:generateContent?key=${this.apiKey}`;
                
                return this.cachedModelUrl;

            } catch (e) {
                console.warn("[AI] Gagal auto-detect model, fallback ke default.");
                // Fallback terakhir jika auto-detect gagal total
                return `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`;
            }
        }

        async _refineWithAI(rawText) {
            if (!this.apiKey) return rawText;
            
            console.log("Mengirim ke Gemini AI...");
            
            try {
                // Gunakan URL hasil auto-detect
                if (!this.apiKey) return rawText;

		        if (!this.modelCache) {
		            try {
		                const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
		                const listData = await listResp.json();
		                if (listData.models) {
		                    const flash = listData.models.find(m => m.name.includes('flash') && m.supportedGenerationMethods?.includes('generateContent'));
		                    this.modelCache = flash ? flash.name : 'models/gemini-1.5-flash';
		                }
		            } catch (e) {
		                this.modelCache = 'models/gemini-1.5-flash';
		            }
		        }
		
		        const prompt = `Perbaiki OCR ini (typo/format):\n\n${rawText}`;
		        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${this.modelCache}:generateContent?key=${this.apiKey}`, {
		            method: 'POST',
		            headers: { 'Content-Type': 'application/json' },
		            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
		        });
                
                const data = await response.json();
                return data.candidates ? data.candidates[0].content.parts[0].text.trim() : rawText;
            } catch (e) {
                console.error("AI Connection Error:", e);
                return rawText; 
            }
        }
    }

    // =========================================================================
    // IV. FUNGSI INTEGRASI UI
    // =========================================================================
    
    const engine = new SmartOCREngine();

    async function sendValidationToRest(extractedText) {
        if (typeof VoucherRest === 'undefined') return;

        try {
            const response = await fetch(VoucherRest.root, {
                method: 'POST',
                headers: { 'X-WP-Nonce': VoucherRest.nonce, 'Content-Type': 'application/json' },
                body: JSON.stringify({ extracted_text: extractedText })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Validasi Server Gagal");
            }

            const data = await response.json();
            
            voucherOutput.textContent = data.voucher_alias;
            fieldOverlay.style.display = 'grid';
            voucherDisplay.style.display = 'grid';

        } catch (error) { 
            console.error("API Error:", error);
            alert(error.message);
        }
    }

    async function Validator() { 
        const files = fileInput.files;
        if (!files || !files[0]) return;
        
        fieldOverlay.style.display = 'grid';
        loadingOverlay.style.display = 'flex';
        voucherDisplay.style.display = 'none'; 

        try {
            const finalText = await engine.process(files[0]);
            await sendValidationToRest(finalText);
        } catch (error) {
            console.error("Validator Error:", error);
            alert(error.message);
            fieldOverlay.style.display = 'none'; 
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }
    
    if (fileInput) fileInput.addEventListener('change', Validator, false);
    if (btnCopyVoucher) {
        btnCopyVoucher.addEventListener('click', function() {
            navigator.clipboard.writeText(voucherOutput.textContent);
            alert("Disalin!");
            fieldOverlay.style.display = 'none';
        });
    }
});
