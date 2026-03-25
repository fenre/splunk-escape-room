/*
 * Nakatomi Terminal — Splunk Custom Visualization
 *
 * Renders search results as scrolling green phosphor CRT terminal text.
 * Each row is displayed as a terminal line with field=value pairs.
 * Supports green and amber color schemes, scanline overlay, and
 * optional timestamp prefixes.
 *
 * Works with any SPL search — all columns are rendered as key=value.
 */
define([
    'api/SplunkVisualizationBase',
    'api/SplunkVisualizationUtils'
], function(SplunkVisualizationBase, SplunkVisualizationUtils) {

    var SCHEMES = {
        green: {
            bg:      '#000d00',
            primary: '#33ff33',
            bright:  '#66ff66',
            dim:     '#1a9a1a',
            dark:    '#0d5a0d',
            border:  '#003300',
            key:     '#1a9a1a',
            value:   '#33ff33',
            header:  '#d4a843',
            time:    '#0d8a0d'
        },
        amber: {
            bg:      '#0d0800',
            primary: '#ffb740',
            bright:  '#ffd080',
            dim:     '#9a7020',
            dark:    '#5a4010',
            border:  '#443000',
            key:     '#9a7020',
            value:   '#ffb740',
            header:  '#ffb740',
            time:    '#5a4010'
        }
    };

    function drawScanlines(ctx, w, h) {
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = '#000000';
        for (var y = 0; y < h; y += 4) {
            ctx.fillRect(0, y, w, 2);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function truncateText(ctx, text, maxW) {
        if (ctx.measureText(text).width <= maxW) return text;
        while (text.length > 1 && ctx.measureText(text + '..').width > maxW) {
            text = text.substring(0, text.length - 1);
        }
        return text + '..';
    }

    function formatTimestamp(raw) {
        if (!raw) return '';
        var d = new Date(raw);
        if (isNaN(d.getTime())) {
            var parts = String(raw).match(/(\d{2}:\d{2}:\d{2})/);
            return parts ? parts[1] : String(raw).substring(0, 8);
        }
        var hh = String(d.getHours()).length < 2 ? '0' + d.getHours() : String(d.getHours());
        var mm = String(d.getMinutes()).length < 2 ? '0' + d.getMinutes() : String(d.getMinutes());
        var ss = String(d.getSeconds()).length < 2 ? '0' + d.getSeconds() : String(d.getSeconds());
        return hh + ':' + mm + ':' + ss;
    }

    return SplunkVisualizationBase.extend({

        initialize: function() {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
            this.el.classList.add('nakatomi-terminal-viz');

            this.canvas = document.createElement('canvas');
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.display = 'block';
            this.el.appendChild(this.canvas);

            this._lastGoodData = null;
            this._blinkState = true;
            var self = this;
            this._blinkInterval = setInterval(function() {
                self._blinkState = !self._blinkState;
                self.invalidateUpdateView();
            }, 600);
        },

        getInitialDataParams: function() {
            return {
                outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                count: 10000
            };
        },

        formatData: function(data, config) {
            if (!data || !data.rows || data.rows.length === 0) {
                if (this._lastGoodData) return this._lastGoodData;
                return { fields: [], rows: [] };
            }

            var fields = [];
            for (var i = 0; i < data.fields.length; i++) {
                fields.push(data.fields[i].name);
            }

            var result = { fields: fields, rows: data.rows };
            this._lastGoodData = result;
            return result;
        },

        updateView: function(data, config) {
            if (!data) {
                if (this._lastGoodData) { data = this._lastGoodData; }
                else { return; }
            }

            var el = this.el;
            var rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;

            var dpr = window.devicePixelRatio || 1;
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            var ctx = this.canvas.getContext('2d');
            if (!ctx) return;
            ctx.scale(dpr, dpr);

            var w = rect.width;
            var h = rect.height;

            var ns = this.getPropertyNamespaceInfo().propertyNamespace;
            var schemeName = config[ns + 'colorScheme'] || 'green';
            var showScanlines = (config[ns + 'showScanlines'] || 'true') === 'true';
            var showTimestamp = (config[ns + 'showTimestamp'] || 'true') === 'true';
            var maxLines = parseInt(config[ns + 'maxLines'] || '50', 10);
            if (isNaN(maxLines) || maxLines < 1) maxLines = 50;

            var scheme = SCHEMES[schemeName] || SCHEMES.green;
            var fields = data.fields || [];
            var rows = data.rows || [];

            ctx.fillStyle = scheme.bg;
            ctx.fillRect(0, 0, w, h);

            var pad = Math.max(6, w * 0.015);
            var fontSize = Math.max(9, Math.min(13, w * 0.014));
            var lineHeight = fontSize * 1.7;

            var headerH = fontSize * 3.5;
            ctx.save();
            ctx.strokeStyle = scheme.border;
            ctx.lineWidth = 2;
            ctx.shadowColor = scheme.dim;
            ctx.shadowBlur = 4;
            ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
            ctx.shadowBlur = 0;
            ctx.restore();

            ctx.save();
            ctx.strokeStyle = scheme.border;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(pad, pad + headerH);
            ctx.lineTo(w - pad, pad + headerH);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.restore();

            ctx.save();
            ctx.shadowColor = scheme.primary;
            ctx.shadowBlur = 6;
            ctx.fillStyle = scheme.primary;
            ctx.font = (fontSize * 1.1) + 'px monospace';
            ctx.fillText('NAKATOMI PLAZA \u2014 TERMINAL OUTPUT', pad * 2, pad + fontSize * 1.4);
            ctx.shadowBlur = 0;
            ctx.restore();

            var rowCountStr = rows.length + ' EVENTS';
            ctx.save();
            ctx.fillStyle = scheme.dim;
            ctx.font = (fontSize * 0.8) + 'px monospace';
            ctx.fillText(rowCountStr, pad * 2, pad + fontSize * 2.8);
            ctx.restore();

            ctx.save();
            ctx.fillStyle = scheme.header;
            ctx.font = (fontSize * 0.8) + 'px monospace';
            ctx.textAlign = 'right';
            ctx.fillText('CLASSIFIED', w - pad * 2, pad + fontSize * 1.4);
            ctx.textAlign = 'left';
            ctx.restore();

            if (rows.length === 0) {
                ctx.save();
                ctx.fillStyle = scheme.dim;
                ctx.font = fontSize + 'px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('AWAITING DATA...', w / 2, h / 2);
                if (this._blinkState) {
                    ctx.fillStyle = scheme.primary;
                    ctx.fillText('\u2588', w / 2 + ctx.measureText('AWAITING DATA...').width / 2 + 8, h / 2);
                }
                ctx.textAlign = 'left';
                ctx.restore();
                if (showScanlines) drawScanlines(ctx, w, h);
                return;
            }

            var contentTop = pad + headerH + pad * 0.5;
            var contentH = h - contentTop - pad;
            var maxVisibleLines = Math.floor(contentH / lineHeight);
            var displayRows = rows;
            if (displayRows.length > maxLines) {
                displayRows = displayRows.slice(displayRows.length - maxLines);
            }
            if (displayRows.length > maxVisibleLines) {
                displayRows = displayRows.slice(displayRows.length - maxVisibleLines);
            }

            var timeIdx = -1;
            for (var f = 0; f < fields.length; f++) {
                if (fields[f] === '_time') { timeIdx = f; break; }
            }

            var maxTextW = w - pad * 4;

            for (var r = 0; r < displayRows.length; r++) {
                var row = displayRows[r];
                var lineY = contentTop + (r * lineHeight) + fontSize;
                var curX = pad * 2;

                if (showTimestamp && timeIdx >= 0 && row[timeIdx]) {
                    var ts = '[' + formatTimestamp(row[timeIdx]) + '] ';
                    ctx.font = fontSize + 'px monospace';
                    ctx.fillStyle = scheme.time;
                    ctx.fillText(ts, curX, lineY);
                    curX += ctx.measureText(ts).width;
                }

                ctx.font = fontSize + 'px monospace';
                var pairs = [];
                for (var c = 0; c < fields.length; c++) {
                    if (c === timeIdx && showTimestamp) continue;
                    if (fields[c].charAt(0) === '_' && fields[c] !== '_raw') continue;
                    var val = row[c];
                    if (val === null || val === undefined || val === '') continue;
                    pairs.push({ key: fields[c], val: String(val) });
                }

                var lineText = '';
                for (var p = 0; p < pairs.length; p++) {
                    if (p > 0) lineText += '  ';
                    lineText += pairs[p].key + '=' + pairs[p].val;
                }

                if (curX + ctx.measureText(lineText).width > w - pad * 2) {
                    lineText = truncateText(ctx, lineText, w - pad * 2 - curX);
                }

                var charX = curX;
                for (var p2 = 0; p2 < pairs.length; p2++) {
                    if (p2 > 0) {
                        ctx.fillStyle = scheme.dark;
                        ctx.fillText('  ', charX, lineY);
                        charX += ctx.measureText('  ').width;
                    }

                    var keyStr = pairs[p2].key + '=';
                    var valStr = pairs[p2].val;

                    if (charX + ctx.measureText(keyStr + valStr).width > w - pad * 2) {
                        valStr = truncateText(ctx, valStr,
                            Math.max(20, w - pad * 2 - charX - ctx.measureText(keyStr).width));
                    }

                    ctx.fillStyle = scheme.key;
                    ctx.fillText(keyStr, charX, lineY);
                    charX += ctx.measureText(keyStr).width;

                    ctx.fillStyle = scheme.value;
                    ctx.fillText(valStr, charX, lineY);
                    charX += ctx.measureText(valStr).width;

                    if (charX > w - pad * 2) break;
                }
            }

            var cursorY = contentTop + (displayRows.length * lineHeight) + fontSize;
            if (cursorY < h - pad) {
                ctx.fillStyle = scheme.dim;
                ctx.font = fontSize + 'px monospace';
                ctx.fillText('>', pad * 2, cursorY);
                if (this._blinkState) {
                    ctx.fillStyle = scheme.primary;
                    ctx.shadowColor = scheme.primary;
                    ctx.shadowBlur = 8;
                    ctx.fillText('\u2588', pad * 2 + ctx.measureText('> ').width, cursorY);
                    ctx.shadowBlur = 0;
                }
            }

            if (showScanlines) {
                drawScanlines(ctx, w, h);
            }
        },

        reflow: function() {
            this.invalidateUpdateView();
        },

        destroy: function() {
            if (this._blinkInterval) {
                clearInterval(this._blinkInterval);
                this._blinkInterval = null;
            }
            SplunkVisualizationBase.prototype.destroy.apply(this, arguments);
        }
    });
});
