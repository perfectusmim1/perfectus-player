/**
 * PerfectusSubtitle — Pure utility subtitle engine.
 *
 * Exposes SRT/VTT parsers, O(log n) active-cue lookup,
 * and Netflix-style subtitle styling helpers.
 * No external dependencies. No DOM manipulation beyond applyStyle.
 */
(function () {
    'use strict';

    /* ──────────────────────────────────────────────
     *  Time-code helpers
     * ────────────────────────────────────────────── */

    /**
     * Convert a time-code string to seconds.
     *
     * Accepted formats:
     *   HH:MM:SS,mmm   (SRT — comma separator)
     *   HH:MM:SS.mmm   (VTT — dot separator)
     *   MM:SS.mmm       (VTT shorthand — no hours)
     *
     * @param {string} raw  The time-code string.
     * @returns {number}    Time in fractional seconds.
     */
    function parseTimecode(raw) {
        const cleaned = raw.trim().replace(',', '.');
        const parts = cleaned.split(':');

        if (parts.length === 3) {
            // HH:MM:SS.mmm
            const hours   = parseFloat(parts[0]);
            const minutes = parseFloat(parts[1]);
            const seconds = parseFloat(parts[2]);
            return hours * 3600 + minutes * 60 + seconds;
        }

        if (parts.length === 2) {
            // MM:SS.mmm  (VTT shorthand)
            const minutes = parseFloat(parts[0]);
            const seconds = parseFloat(parts[1]);
            return minutes * 60 + seconds;
        }

        return 0;
    }

    /* ──────────────────────────────────────────────
     *  SRT Parser
     * ────────────────────────────────────────────── */

    /**
     * Parse an SRT subtitle string into an array of cue objects.
     *
     * SRT block format:
     *   1
     *   00:00:01,000 --> 00:00:04,000
     *   First line of text
     *   Optional second line
     *
     * @param {string} text  Raw SRT file content.
     * @returns {Array<{id: number, start: number, end: number, text: string}>}
     *          Cues sorted by ascending start time.
     */
    function parseSRT(text) {
        if (!text) return [];

        // Strip BOM (U+FEFF) and normalise line endings to \n
        const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

        // Split on one or more blank lines to separate cue blocks
        const blocks = cleaned.split(/\n{2,}/);
        const cues = [];

        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i].trim();
            if (!block) continue;

            const lines = block.split('\n');

            // We need at least a sequence number, a timing line, and one text line
            if (lines.length < 3) continue;

            // First line: sequence number
            const id = parseInt(lines[0].trim(), 10);
            if (isNaN(id)) continue;

            // Second line: timing  "HH:MM:SS,mmm --> HH:MM:SS,mmm"
            const timingLine = lines[1].trim();
            const arrowIdx = timingLine.indexOf('-->');
            if (arrowIdx === -1) continue;

            const startStr = timingLine.substring(0, arrowIdx).trim();
            const endStr   = timingLine.substring(arrowIdx + 3).trim();

            const start = parseTimecode(startStr);
            const end   = parseTimecode(endStr);

            // Remaining lines: subtitle text (join with <br> for multi-line)
            const textContent = lines.slice(2).join('<br>');

            cues.push({ id, start, end, text: textContent });
        }

        // Ensure cues are sorted by start time
        cues.sort((a, b) => a.start - b.start);
        return cues;
    }

    /* ──────────────────────────────────────────────
     *  VTT Parser
     * ────────────────────────────────────────────── */

    /**
     * Parse a WebVTT subtitle string into an array of cue objects.
     *
     * Handles:
     * - WEBVTT header line (required, skipped)
     * - Optional cue IDs
     * - STYLE / REGION / NOTE blocks (skipped)
     * - HH:MM:SS.mmm and MM:SS.mmm time formats
     * - Multi-line cue text (joined with <br>)
     *
     * @param {string} text  Raw VTT file content.
     * @returns {Array<{id: number|string, start: number, end: number, text: string}>}
     *          Cues sorted by ascending start time.
     */
    function parseVTT(text) {
        if (!text) return [];

        // Strip BOM and normalise line endings
        const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

        // Split on double-newlines to get blocks
        const blocks = cleaned.split(/\n{2,}/);

        // The first block must start with "WEBVTT" — skip it
        let startIdx = 0;
        if (blocks.length > 0 && blocks[0].trim().startsWith('WEBVTT')) {
            startIdx = 1;
        }

        const cues = [];
        let autoId = 1;

        /**
         * Detect whether a block is a metadata block (STYLE, REGION, NOTE)
         * that should be skipped entirely.
         */
        const SKIP_PREFIXES = ['STYLE', 'REGION', 'NOTE'];

        for (let i = startIdx; i < blocks.length; i++) {
            const block = blocks[i].trim();
            if (!block) continue;

            // Skip metadata blocks
            const firstLine = block.split('\n')[0].trim();
            if (SKIP_PREFIXES.some(prefix => firstLine.startsWith(prefix))) {
                continue;
            }

            const lines = block.split('\n');

            // Find the timing line (contains "-->")
            let timingLineIdx = -1;
            for (let j = 0; j < lines.length; j++) {
                if (lines[j].includes('-->')) {
                    timingLineIdx = j;
                    break;
                }
            }

            if (timingLineIdx === -1) continue; // Not a cue block

            // Optional cue ID sits on lines before the timing line
            let cueId = autoId++;
            if (timingLineIdx > 0) {
                cueId = lines.slice(0, timingLineIdx).join(' ').trim() || cueId;
            }

            // Parse timing
            const timingLine = lines[timingLineIdx].trim();
            const arrowIdx = timingLine.indexOf('-->');
            const startStr = timingLine.substring(0, arrowIdx).trim();
            // End string may include positioning settings after the timestamp;
            // grab only the timestamp portion (first token).
            const endRaw  = timingLine.substring(arrowIdx + 3).trim();
            const endStr  = endRaw.split(/\s+/)[0];

            const start = parseTimecode(startStr);
            const end   = parseTimecode(endStr);

            // Cue text: everything after the timing line
            const textContent = lines.slice(timingLineIdx + 1).join('<br>');

            if (textContent) {
                cues.push({ id: cueId, start, end, text: textContent });
            }
        }

        // Ensure cues are sorted by start time
        cues.sort((a, b) => a.start - b.start);
        return cues;
    }

    /* ──────────────────────────────────────────────
     *  Binary-search cue lookup
     * ────────────────────────────────────────────── */

    /**
     * Find the active cue at `currentTime` using binary search.
     *
     * Assumes `cues` is sorted by start time (ascending).
     * Runs in O(log n) — suitable for calling every ~250 ms.
     *
     * @param {Array<{start: number, end: number, text: string}>} cues
     * @param {number} currentTime  Current playback position in seconds.
     * @returns {{text: string}|null}  The active cue's text, or null.
     */
    function findActiveCue(cues, currentTime) {
        if (!cues || cues.length === 0) return null;

        let lo = 0;
        let hi = cues.length - 1;

        while (lo <= hi) {
            const mid = (lo + hi) >>> 1; // unsigned right-shift for floor
            const cue = cues[mid];

            if (currentTime < cue.start) {
                // Current time is before this cue — search left
                hi = mid - 1;
            } else if (currentTime > cue.end) {
                // Current time is past this cue — search right
                lo = mid + 1;
            } else {
                // start <= currentTime <= end  → match!
                return { text: cue.text };
            }
        }

        return null;
    }

    /* ──────────────────────────────────────────────
     *  Style helpers
     * ────────────────────────────────────────────── */

    /**
     * Return the default Netflix-style subtitle configuration.
     *
     * @returns {{
     *   fontSize: number,
     *   fontColor: string,
     *   bgEnabled: boolean,
     *   bgColor: string,
     *   bgOpacity: number,
     *   shadowEnabled: boolean
     * }}
     */
    function getDefaultStyle() {
        return {
            fontSize:      28,
            fontColor:      '#FFFFFF',
            bgEnabled:      true,
            bgColor:        '#000000',
            bgOpacity:      0.75,
            shadowEnabled:  true,
        };
    }

    /**
     * Convert a hex colour string (#RRGGBB) and opacity (0–1) to an
     * `rgba(r, g, b, a)` CSS value.
     *
     * @param {string} hex     Hex colour, e.g. "#000000".
     * @param {number} opacity Opacity between 0 and 1.
     * @returns {string}       CSS rgba string.
     */
    function hexToRgba(hex, opacity) {
        const normalised = hex.replace('#', '');
        const r = parseInt(normalised.substring(0, 2), 16);
        const g = parseInt(normalised.substring(2, 4), 16);
        const b = parseInt(normalised.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    /**
     * Apply subtitle styles to a given DOM element.
     *
     * @param {HTMLElement} element      The subtitle overlay element.
     * @param {{
     *   fontSize?: number,
     *   fontColor?: string,
     *   bgEnabled?: boolean,
     *   bgColor?: string,
     *   bgOpacity?: number,
     *   shadowEnabled?: boolean
     * }} styleConfig  Style configuration (missing keys fall back to defaults).
     */
    function applyStyle(element, styleConfig) {
        if (!element || !styleConfig) return;

        const cfg = Object.assign({}, getDefaultStyle(), styleConfig);

        // Font
        element.style.fontSize = cfg.fontSize + 'px';
        element.style.color    = cfg.fontColor;

        // Background
        if (cfg.bgEnabled) {
            element.style.backgroundColor = hexToRgba(cfg.bgColor, cfg.bgOpacity);
        } else {
            element.style.backgroundColor = 'transparent';
        }

        // Text shadow
        if (cfg.shadowEnabled) {
            element.style.textShadow =
                '0 2px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.5)';
        } else {
            element.style.textShadow = 'none';
        }
    }

    /* ──────────────────────────────────────────────
     *  Public API
     * ────────────────────────────────────────────── */

    window.PerfectusSubtitle = {
        parseSRT:        parseSRT,
        parseVTT:        parseVTT,
        findActiveCue:   findActiveCue,
        applyStyle:      applyStyle,
        getDefaultStyle: getDefaultStyle,
    };
})();
