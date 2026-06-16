/**
 * PerfectusTranslate — Gemini API Translation Module
 * 
 * Translates subtitle cues using Google's Gemini generative AI API.
 * Exposes itself via window.PerfectusTranslate.
 * 
 * No external dependencies — uses native fetch API.
 */

(function () {
    'use strict';

    // ── Constants ────────────────────────────────────────────────────────

    /** Number of cues to send per API request */
    const BATCH_SIZE = 400;

    /** Default Gemini model */
    const DEFAULT_MODEL = 'gemini-3.5-flash';

    /** Gemini API base URL */
    const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

    // ── Supported Languages ─────────────────────────────────────────────

    /**
     * 40 supported languages with ISO 639-1 codes and Turkish display names.
     * Order is intentional and must be preserved.
     */
    const SUPPORTED_LANGUAGES = [
        { code: 'tr', name: 'Türkçe' },
        { code: 'en', name: 'İngilizce' },
        { code: 'de', name: 'Almanca' },
        { code: 'fr', name: 'Fransızca' },
        { code: 'es', name: 'İspanyolca' },
        { code: 'it', name: 'İtalyanca' },
        { code: 'pt', name: 'Portekizce' },
        { code: 'ru', name: 'Rusça' },
        { code: 'ja', name: 'Japonca' },
        { code: 'ko', name: 'Korece' },
        { code: 'zh-Hans', name: 'Çince (Basitleştirilmiş)' },
        { code: 'zh-Hant', name: 'Çince (Geleneksel)' },
        { code: 'ar', name: 'Arapça' },
        { code: 'hi', name: 'Hintçe' },
        { code: 'bn', name: 'Bengalce' },
        { code: 'ur', name: 'Urduca' },
        { code: 'fa', name: 'Farsça' },
        { code: 'vi', name: 'Vietnamca' },
        { code: 'th', name: 'Tayca' },
        { code: 'id', name: 'Endonezyaca' },
        { code: 'ms', name: 'Malayca' },
        { code: 'fil', name: 'Filipince' },
        { code: 'pl', name: 'Lehçe' },
        { code: 'cs', name: 'Çekçe' },
        { code: 'sk', name: 'Slovakça' },
        { code: 'hu', name: 'Macarca' },
        { code: 'ro', name: 'Romence' },
        { code: 'bg', name: 'Bulgarca' },
        { code: 'hr', name: 'Hırvatça' },
        { code: 'sr', name: 'Sırpça' },
        { code: 'el', name: 'Yunanca' },
        { code: 'uk', name: 'Ukraynaca' },
        { code: 'sv', name: 'İsveççe' },
        { code: 'no', name: 'Norveççe' },
        { code: 'da', name: 'Danca' },
        { code: 'fi', name: 'Fince' },
        { code: 'nl', name: 'Felemenkçe' },
        { code: 'he', name: 'İbranice' },
        { code: 'sw', name: 'Swahilice' },
        { code: 'ca', name: 'Katalanca' },
    ];

    // ── Helper Functions ────────────────────────────────────────────────

    /**
     * Splits an array into chunks of the given size.
     * @param {Array} array - Source array to split
     * @param {number} size - Maximum chunk size
     * @returns {Array[]} Array of chunks
     */
    function chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Returns a promise that resolves after the specified delay.
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise<void>}
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Returns the fallback model for the given current model.
     * @param {string} currentModel - Currently active model name
     * @returns {string} The alternate model to fall back to
     */
    function getFallbackModel(currentModel) {
        return currentModel === 'gemini-3.5-flash'
            ? 'gemini-3.1-flash-lite'
            : 'gemini-3.5-flash';
    }

    /**
     * Builds the translation prompt for a batch of cues.
     * @param {Array<{id, start, end, text}>} batch - Subtitle cues
     * @param {string} targetLang - Target language name
     * @returns {string} Formatted prompt string
     */
    function buildPrompt(batch, targetLang) {
        const texts = batch.map(cue => cue.text);
        return (
            `Aşağıdaki altyazı metinleri dizisini ${targetLang} diline çevir. ` +
            `Orijinal sırayı ve dizi uzunluğunu kesinlikle koru. ` +
            `Hiçbir satırı atlama, birleştirme veya bölme. ` +
            `Çeviriyi şu JSON formatında dizi olarak döndür: ["çeviri1", "çeviri2", ...]\n\n` +
            JSON.stringify(texts)
        );
    }

    // ── Core Translation Logic ──────────────────────────────────────────

    /**
     * Sends a single batch of cues to the Gemini API for translation.
     * @param {Array<{id, start, end, text}>} batch - Cues to translate
     * @param {string} targetLang - Target language name
     * @param {string} apiKey - Gemini API key
     * @param {string} model - Gemini model name
     * @param {number} [thinkingBudget=0] - Thinking budget (0 = disabled, 1024/4096/8192/16384)
     * @returns {Promise<Array<{id, start, end, text}>>} Translated cues
     */
    async function translateBatch(batch, targetLang, apiKey, model, thinkingBudget = 0) {
        const endpoint = `${API_BASE}/${model}:generateContent?key=${apiKey}`;
        const prompt = buildPrompt(batch, targetLang);

        // Build the request payload
        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: prompt }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.3,
                responseMimeType: "application/json",
                ...(thinkingBudget > 0 ? { thinkingConfig: { thinkingBudget: thinkingBudget } } : {})
            }
        };

        // Send the request
        let response;
        try {
            response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });
        } catch (networkError) {
            throw new Error(
                `Ağ hatası: Gemini API'ye bağlanılamadı — ${networkError.message}`
            );
        }

        // Parse the JSON response
        const data = await response.json();

        // Check for API-level errors (400, 403, etc.)
        if (!response.ok || data.error) {
            const errorMessage =
                data?.error?.message || `API hatası (HTTP ${response.status})`;
            throw new Error(`Gemini API hatası: ${errorMessage}`);
        }

        // Extract the generated text
        const generatedText =
            data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

        let cleanText = generatedText.trim();
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```(?:json)?\n?/i, '');
            cleanText = cleanText.replace(/\n?```$/i, '');
            cleanText = cleanText.trim();
        }

        let translatedTexts = [];
        try {
            translatedTexts = JSON.parse(cleanText);
        } catch (e) {
            console.error('JSON parsing failed, falling back to regex. Text:', cleanText);
            try {
                const matches = cleanText.match(/"([^"\\]|\\.)*"/g);
                if (matches) {
                    translatedTexts = matches.map(s => JSON.parse(s));
                }
            } catch (err) {
                console.error('Regex fallback failed:', err);
            }
        }

        return batch.map((cue, index) => ({
            id: cue.id,
            start: cue.start,
            end: cue.end,
            text: (translatedTexts && index < translatedTexts.length) ? translatedTexts[index] : cue.text,
        }));
    }

    /**
     * Translates an array of subtitle cues into the target language
     * using the Gemini generative AI API.
     *
     * @param {Array<{id, start, end, text}>} cues - Subtitle cues to translate
     * @param {string} targetLang - Target language name (e.g. 'Japonca', 'English')
     * @param {string} apiKey - Gemini API key
     * @param {string} [model='gemini-3.5-flash'] - Gemini model name
     * @param {Function} [onProgress] - Callback `(completedCount, totalCount)`
     * @param {number} [thinkingBudget=0] - Thinking budget (0 = disabled, 1024/4096/8192/16384)
     * @returns {Promise<Array<{id, start, end, text}>>} Translated cues
     * @throws {Error} If API key is missing, network fails, or API returns an error
     */
    async function translateSubtitles(
        cues,
        targetLang,
        apiKey,
        model = DEFAULT_MODEL,
        onProgress = null,
        thinkingBudget = 0
    ) {
        // ── Validate API key ────────────────────────────────────────────
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
            throw new Error('API anahtarı gereklidir');
        }

        // Handle empty input gracefully
        if (!cues || cues.length === 0) {
            return [];
        }

        // ── Split into batches of BATCH_SIZE ────────────────────────────
        const batches = chunkArray(cues, BATCH_SIZE);
        const totalCues = cues.length;
        const translatedCues = [];
        let completedCount = 0;

        // ── Retry configuration ─────────────────────────────────────────
        const MAX_RETRIES = 2;
        const RETRY_DELAY_MS = 3000;
        let activeModel = model;

        // ── Process each batch sequentially ─────────────────────────────
        for (const batch of batches) {
            let translated = null;
            let lastError = null;

            // ── Retry loop: up to MAX_RETRIES with the active model ─────
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    translated = await translateBatch(batch, targetLang, apiKey, activeModel, thinkingBudget);
                    break; // success — exit retry loop
                } catch (error) {
                    lastError = error;
                    console.warn(
                        `[PerfectusTranslate] Deneme ${attempt}/${MAX_RETRIES} başarısız (model: ${activeModel}): ${error.message}`
                    );
                    if (attempt < MAX_RETRIES) {
                        await delay(RETRY_DELAY_MS);
                    }
                }
            }

            // ── Fallback: try the alternate model once ──────────────────
            if (!translated) {
                const fallbackModel = getFallbackModel(activeModel);
                console.warn(
                    `[PerfectusTranslate] Yedek modele geçiliyor: ${fallbackModel}`
                );
                await delay(RETRY_DELAY_MS);

                try {
                    translated = await translateBatch(batch, targetLang, apiKey, fallbackModel, thinkingBudget);
                    // Fallback succeeded — use it for remaining batches
                    activeModel = fallbackModel;
                    console.warn(
                        `[PerfectusTranslate] Yedek model başarılı. Kalan gruplar için ${fallbackModel} kullanılacak.`
                    );
                } catch (fallbackError) {
                    throw new Error(
                        `Çeviri hatası (${completedCount}/${totalCues} tamamlandı): ` +
                        `Ana model (${model}) ve yedek model (${fallbackModel}) başarısız oldu. ` +
                        `Son hata: ${fallbackError.message}`
                    );
                }
            }

            translatedCues.push(...translated);
            completedCount += batch.length;

            // Notify progress
            if (typeof onProgress === 'function') {
                onProgress(completedCount, totalCues);
            }
        }

        return translatedCues;
    }

    /**
     * Returns the list of 40 supported languages with ISO codes and Turkish names.
     * @returns {Array<{code: string, name: string}>}
     */
    function getSupportedLanguages() {
        // Return a shallow copy to prevent external mutation
        return SUPPORTED_LANGUAGES.map(lang => ({ ...lang }));
    }

    // ── Public API ──────────────────────────────────────────────────────

    window.PerfectusTranslate = {
        translateSubtitles,
        getSupportedLanguages,
    };
})();
