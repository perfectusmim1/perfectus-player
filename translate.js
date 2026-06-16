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
    const BATCH_SIZE = 20;

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
     * Builds the translation prompt for a batch of cues.
     * @param {Array<{id, start, end, text}>} batch - Subtitle cues
     * @param {string} targetLang - Target language name
     * @returns {string} Formatted prompt string
     */
    function buildPrompt(batch, targetLang) {
        const lines = batch
            .map((cue, index) => `${index + 1}: ${cue.text}`)
            .join('\n');

        return (
            `Aşağıdaki altyazı satırlarını ${targetLang} diline çevir. ` +
            `Her satırı ayrı ayrı çevir ve sadece çevirileri satır satır döndür. ` +
            `Satır numarası veya zaman kodu EKLEME. Orijinal satır sayısını koru.\n\n` +
            lines
        );
    }

    /**
     * Parses the Gemini response text into an array of translated strings.
     * Handles numbered prefixes (e.g. "1: translated text") and blank lines.
     * @param {string} responseText - Raw text from the API
     * @param {number} expectedCount - Number of lines we expect
     * @returns {string[]} Array of translated strings
     */
    function parseResponseLines(responseText, expectedCount) {
        // Split by newlines and filter out empty lines
        const rawLines = responseText.split('\n').filter(line => line.trim() !== '');

        // Strip numbered prefixes like "1: ", "2: ", "10: " etc.
        const cleaned = rawLines.map(line => {
            return line.replace(/^\d+\s*[:\.]\s*/, '').trim();
        });

        // Warn if line count doesn't match
        if (cleaned.length !== expectedCount) {
            console.warn(
                `[PerfectusTranslate] Beklenen satır sayısı: ${expectedCount}, ` +
                `alınan: ${cleaned.length}. Mevcut satırlar kullanılacak.`
            );
        }

        return cleaned;
    }

    // ── Core Translation Logic ──────────────────────────────────────────

    /**
     * Sends a single batch of cues to the Gemini API for translation.
     * @param {Array<{id, start, end, text}>} batch - Cues to translate
     * @param {string} targetLang - Target language name
     * @param {string} apiKey - Gemini API key
     * @param {string} model - Gemini model name
     * @returns {Promise<Array<{id, start, end, text}>>} Translated cues
     */
    async function translateBatch(batch, targetLang, apiKey, model) {
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
                temperature: 0.3
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
            data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse response lines and map back to cue objects
        const translatedLines = parseResponseLines(generatedText, batch.length);

        return batch.map((cue, index) => ({
            id: cue.id,
            start: cue.start,
            end: cue.end,
            text: index < translatedLines.length ? translatedLines[index] : cue.text,
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
     * @returns {Promise<Array<{id, start, end, text}>>} Translated cues
     * @throws {Error} If API key is missing, network fails, or API returns an error
     */
    async function translateSubtitles(
        cues,
        targetLang,
        apiKey,
        model = DEFAULT_MODEL,
        onProgress = null
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

        // ── Process each batch sequentially ─────────────────────────────
        for (const batch of batches) {
            try {
                const translated = await translateBatch(batch, targetLang, apiKey, model);
                translatedCues.push(...translated);
                completedCount += batch.length;

                // Notify progress
                if (typeof onProgress === 'function') {
                    onProgress(completedCount, totalCues);
                }
            } catch (error) {
                // If any batch fails, throw immediately
                throw new Error(
                    `Çeviri hatası (${completedCount}/${totalCues} tamamlandı): ${error.message}`
                );
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
