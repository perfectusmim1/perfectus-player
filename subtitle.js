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
     *  Matroska (MKV/WebM) Subtitle Parser
     * ────────────────────────────────────────────── */

    const EBML_TAGS = {
        Segment: 0x18538067,
        Tracks: 0x1654AE6B,
        TrackEntry: 0xAE,
        TrackNumber: 0xD7,
        TrackType: 0x83,
        Language: 0x22B59C,
        Name: 0x536E,
        CodecID: 0x86,
        CodecPrivate: 0x63A2,
        TimecodeScale: 0x2AD7B1,
        Cluster: 0x1F43B675,
        Timecode: 0xE7,
        BlockGroup: 0xA0,
        Block: 0xA1,
        SimpleBlock: 0xA3,
        BlockDuration: 0x9B
    };

    const CONTAINER_IDS = new Set([
        EBML_TAGS.Segment,
        EBML_TAGS.Tracks,
        EBML_TAGS.TrackEntry,
        EBML_TAGS.Cluster,
        EBML_TAGS.BlockGroup
    ]);

    class FileBufferReader {
        constructor(file) {
            this.file = file;
            this.fileSize = file.size;
            this.offset = 0;
            this.buffer = new Uint8Array(0);
            this.bufferOffset = 0;
        }

        async ensureBytes(length) {
            const available = this.buffer.length - (this.offset - this.bufferOffset);
            if (available >= length) {
                return true;
            }
            const currentBufferEnd = this.bufferOffset + this.buffer.length;
            if (currentBufferEnd >= this.fileSize) {
                return false;
            }
            const neededMore = length - available;
            const readLength = Math.max(2 * 1024 * 1024, neededMore);
            const start = currentBufferEnd;
            const end = Math.min(this.fileSize, start + readLength);
            if (start === end) return false;

            const slice = this.file.slice(start, end);
            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(slice);
            });
            const newChunk = new Uint8Array(arrayBuffer);
            const unreadOffset = this.offset - this.bufferOffset;
            const unreadBytes = this.buffer.subarray(unreadOffset);
            const merged = new Uint8Array(unreadBytes.length + newChunk.length);
            merged.set(unreadBytes, 0);
            merged.set(newChunk, unreadBytes.length);

            this.buffer = merged;
            this.bufferOffset = this.offset;
            return this.buffer.length >= length;
        }

        getUint8Array(length) {
            const start = this.offset - this.bufferOffset;
            const sub = this.buffer.subarray(start, start + length);
            this.offset += length;
            return sub;
        }

        skip(length) {
            this.offset += length;
        }
    }

    function readVint(uint8Array, startOffset) {
        if (startOffset >= uint8Array.length) return null;
        const firstByte = uint8Array[startOffset];
        if (firstByte === 0) return null;
        const length = 8 - Math.floor(Math.log2(firstByte));
        if (startOffset + length > uint8Array.length) return null;

        let value = firstByte & ((1 << (8 - length)) - 1);
        for (let i = 1; i < length; i++) {
            value = (value * 256) + uint8Array[startOffset + i];
        }

        const maxVal = Math.pow(2, 7 * length) - 1;
        if (value === maxVal) {
            value = -1;
        }
        return { length, value };
    }

    function readId(uint8Array, startOffset) {
        if (startOffset >= uint8Array.length) return null;
        const firstByte = uint8Array[startOffset];
        if (firstByte === 0) return null;
        const length = 8 - Math.floor(Math.log2(firstByte));
        if (startOffset + length > uint8Array.length) return null;

        let id = 0;
        for (let i = 0; i < length; i++) {
            id = (id * 256) + uint8Array[startOffset + i];
        }
        return { length, value: id };
    }

    async function readUint(reader, size) {
        const ok = await reader.ensureBytes(size);
        if (!ok) {
            reader.skip(size);
            return 0;
        }
        const bytes = reader.getUint8Array(size);
        let val = 0;
        for (let i = 0; i < size; i++) {
            val = (val * 256) + bytes[i];
        }
        return val;
    }

    async function readString(reader, size) {
        const ok = await reader.ensureBytes(size);
        if (!ok) {
            reader.skip(size);
            return '';
        }
        const bytes = reader.getUint8Array(size);
        const textDecoder = new TextDecoder('utf-8');
        return textDecoder.decode(bytes).trim();
    }

    async function readBytes(reader, size) {
        const ok = await reader.ensureBytes(size);
        if (!ok) {
            reader.skip(size);
            return null;
        }
        return reader.getUint8Array(size);
    }

    async function parseMKV(file) {
        const reader = new FileBufferReader(file);
        const tracks = new Map();
        const cuesMap = new Map();

        let currentTrack = null;
        let clusterTimecode = 0;
        let timecodeScale = 1.0;
        let lastCue = null;

        while (reader.offset < reader.fileSize) {
            const ok = await reader.ensureBytes(12);
            if (!ok) break;

            const bufferIdx = reader.offset - reader.bufferOffset;

            // Read ID
            const idVint = readId(reader.buffer, bufferIdx);
            if (!idVint) break;
            const id = idVint.value;
            reader.skip(idVint.length);

            // Read Size
            const sizeVint = readVint(reader.buffer, reader.offset - reader.bufferOffset);
            if (!sizeVint) break;
            const size = sizeVint.value;
            reader.skip(sizeVint.length);

            if (CONTAINER_IDS.has(id)) {
                if (id === EBML_TAGS.TrackEntry) {
                    if (currentTrack && currentTrack.number !== null && currentTrack.type === 0x11) {
                        tracks.set(currentTrack.number, currentTrack);
                        cuesMap.set(currentTrack.number, []);
                    }
                    currentTrack = {
                        number: null,
                        type: null,
                        codecId: null,
                        language: 'und',
                        name: '',
                        codecPrivate: null
                    };
                }
                continue; // Descend
            }

            if (size === -1) {
                continue;
            }

            if (id === EBML_TAGS.TrackNumber) {
                const val = await readUint(reader, size);
                if (currentTrack) currentTrack.number = val;
            } else if (id === EBML_TAGS.TrackType) {
                const val = await readUint(reader, size);
                if (currentTrack) currentTrack.type = val;
            } else if (id === EBML_TAGS.CodecID) {
                const val = await readString(reader, size);
                if (currentTrack) currentTrack.codecId = val;
            } else if (id === EBML_TAGS.Language) {
                const val = await readString(reader, size);
                if (currentTrack) currentTrack.language = val;
            } else if (id === EBML_TAGS.Name) {
                const val = await readString(reader, size);
                if (currentTrack) currentTrack.name = val;
            } else if (id === EBML_TAGS.CodecPrivate) {
                const val = await readBytes(reader, size);
                if (currentTrack) currentTrack.codecPrivate = val;
            } else if (id === EBML_TAGS.TimecodeScale) {
                const scale = await readUint(reader, size);
                timecodeScale = scale / 1000000.0;
            } else if (id === EBML_TAGS.Timecode) {
                clusterTimecode = await readUint(reader, size);
            } else if (id === EBML_TAGS.Block || id === EBML_TAGS.SimpleBlock) {
                const blockOk = await reader.ensureBytes(size);
                if (blockOk) {
                    const blockBuffer = reader.getUint8Array(size);
                    const trackNumVint = readVint(blockBuffer, 0);
                    if (trackNumVint) {
                        const trackNumber = trackNumVint.value;

                        if (currentTrack) {
                            if (currentTrack.number !== null && currentTrack.type === 0x11) {
                                tracks.set(currentTrack.number, currentTrack);
                                cuesMap.set(currentTrack.number, []);
                            }
                            currentTrack = null;
                        }

                        const track = tracks.get(trackNumber);
                        if (track && track.type === 0x11) {
                            let offset = trackNumVint.length;
                            if (offset + 2 <= size) {
                                const relativeTimecode = (blockBuffer[offset] << 8) | blockBuffer[offset + 1];
                                const signedRelativeTimecode = (relativeTimecode & 0x8000) ? (relativeTimecode - 0x10000) : relativeTimecode;
                                offset += 2;
                                offset += 1; // flags

                                if (offset < size) {
                                    const payload = blockBuffer.subarray(offset);
                                    const textDecoder = new TextDecoder('utf-8');
                                    let text = textDecoder.decode(payload);

                                    if (track.codecId && (track.codecId.includes('ASS') || track.codecId.includes('SSA'))) {
                                        const parts = text.split(',');
                                        if (parts.length >= 9) {
                                            text = parts.slice(8).join(',');
                                        }
                                    }

                                    text = text.replace(/\{[^}]+\}/g, '').trim();
                                    text = text.replace(/\\N/g, '<br>');

                                    const startTime = (clusterTimecode + signedRelativeTimecode) * timecodeScale / 1000.0;

                                    const cue = {
                                        id: (cuesMap.get(trackNumber).length + 1),
                                        start: startTime,
                                        end: startTime + 4.0, // Default 4 seconds
                                        text: text
                                    };
                                    cuesMap.get(trackNumber).push(cue);
                                    lastCue = cue;
                                }
                            }
                        }
                    }
                } else {
                    reader.skip(size);
                }
            } else if (id === EBML_TAGS.BlockDuration) {
                const duration = await readUint(reader, size);
                if (lastCue) {
                    lastCue.end = lastCue.start + (duration * timecodeScale / 1000.0);
                }
            } else if (id === EBML_TAGS.Cluster) {
                if (currentTrack) {
                    if (currentTrack.number !== null && currentTrack.type === 0x11) {
                        tracks.set(currentTrack.number, currentTrack);
                        cuesMap.set(currentTrack.number, []);
                    }
                    currentTrack = null;
                }
            } else {
                reader.skip(size);
            }
        }

        if (currentTrack && currentTrack.number !== null && currentTrack.type === 0x11) {
            tracks.set(currentTrack.number, currentTrack);
            cuesMap.set(currentTrack.number, []);
        }

        const resultTracks = [];
        for (const [trackNumber, trackInfo] of tracks.entries()) {
            const cues = cuesMap.get(trackNumber) || [];
            cues.sort((a, b) => a.start - b.start);
            resultTracks.push({
                number: trackNumber,
                name: trackInfo.name || `Altyazı Kanalı ${trackNumber} (${trackInfo.language || 'und'})`,
                language: trackInfo.language,
                codecId: trackInfo.codecId,
                cues: cues
            });
        }

        return resultTracks;
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
        parseMKV:        parseMKV,
    };
})();
