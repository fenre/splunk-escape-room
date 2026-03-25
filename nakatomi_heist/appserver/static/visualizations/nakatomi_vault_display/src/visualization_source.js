/*
 * Nakatomi Vault Display — Splunk Custom Visualization
 *
 * Renders a CRT-style terminal display showing the status of
 * seven electromagnetic vault seals. Green phosphor text, animated
 * LEDs, scanline overlay, and blinking cursor.
 *
 * Expected SPL columns: seal (number), name (string), status (string)
 * Status values: LOCKED, ACTIVE, OPEN, ???
 */
define([
    'api/SplunkVisualizationBase',
    'api/SplunkVisualizationUtils'
], function(SplunkVisualizationBase, SplunkVisualizationUtils) {

    var SCHEMES = {
        green: {
            bg:       '#000d00',
            primary:  '#33ff33',
            bright:   '#66ff66',
            dim:      '#1a9a1a',
            dark:     '#0d5a0d',
            surface:  '#001a00',
            border:   '#003300',
            amber:    '#d4a843',
            red:      '#ff3333',
            redDim:   '#661a1a'
        },
        amber: {
            bg:       '#0d0800',
            primary:  '#ffb740',
            bright:   '#ffd080',
            dim:      '#9a7020',
            dark:     '#5a4010',
            surface:  '#1a0f00',
            border:   '#443000',
            amber:    '#d4a843',
            red:      '#ff3333',
            redDim:   '#661a1a'
        }
    };

    var DEFAULT_SEALS = [
        {num: 1, name: 'THE LOBBY',              status: 'LOCKED'},
        {num: 2, name: 'SECURING THE BUILDING',  status: 'LOCKED'},
        {num: 3, name: "TAKAGI'S REFUSAL",       status: 'LOCKED'},
        {num: 4, name: 'THE ROOF TRAP',          status: 'LOCKED'},
        {num: 5, name: 'THE FBI',                status: 'LOCKED'},
        {num: 6, name: 'THE BEARER BONDS',       status: 'LOCKED'},
        {num: 7, name: '???',                    status: '???'}
    ];

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

    function drawGlowText(ctx, text, x, y, color, fontSize, glowRadius) {
        ctx.save();
        if (glowRadius) {
            ctx.shadowColor = color;
            ctx.shadowBlur = glowRadius;
        }
        ctx.fillStyle = color;
        ctx.font = fontSize + 'px monospace';
        ctx.fillText(text, x, y);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawLED(ctx, x, y, radius, color, glowColor) {
        ctx.save();
        ctx.shadowColor = glowColor || color;
        ctx.shadowBlur = radius * 4;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fill();
        ctx.restore();
    }

    function drawBoxBorder(ctx, x, y, w, h, color, lineWidth) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth || 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.strokeRect(x, y, w, h);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawHLine(ctx, x1, x2, y, color) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    return SplunkVisualizationBase.extend({

        initialize: function() {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
            this.el.classList.add('nakatomi-vault-display-viz');

            this.canvas = document.createElement('canvas');
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.display = 'block';
            this.el.appendChild(this.canvas);

            this._lastGoodData = null;
            this._blinkState = true;
            this._blinkInterval = null;
        },

        getInitialDataParams: function() {
            return {
                outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                count: 50
            };
        },

        formatData: function(data, config) {
            if (!data || !data.rows || data.rows.length === 0) {
                if (this._lastGoodData) return this._lastGoodData;
                return { seals: DEFAULT_SEALS };
            }

            var fields = data.fields;
            var colIdx = {};
            for (var i = 0; i < fields.length; i++) {
                colIdx[fields[i].name] = i;
            }

            var sealIdx = colIdx.seal !== undefined ? colIdx.seal : colIdx.seal_number;
            var nameIdx = colIdx.name !== undefined ? colIdx.name : colIdx.seal_name;
            var statusIdx = colIdx.status;

            var seals = [];
            for (var r = 0; r < data.rows.length && r < 7; r++) {
                var row = data.rows[r];
                seals.push({
                    num: sealIdx !== undefined ? parseInt(row[sealIdx], 10) : (r + 1),
                    name: nameIdx !== undefined ? String(row[nameIdx]).toUpperCase() : '',
                    status: statusIdx !== undefined ? String(row[statusIdx]).toUpperCase() : 'LOCKED'
                });
            }

            var result = { seals: seals };
            this._lastGoodData = result;
            return result;
        },

        updateView: function(data, config) {
            if (!data) {
                if (this._lastGoodData) { data = this._lastGoodData; }
                else { data = { seals: DEFAULT_SEALS }; }
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
            var animate = (config[ns + 'animate'] || 'true') === 'true';

            if (animate && !this._blinkInterval) {
                var self = this;
                this._blinkInterval = setInterval(function() {
                    self._blinkState = !self._blinkState;
                    self.invalidateUpdateView();
                }, 800);
            } else if (!animate && this._blinkInterval) {
                clearInterval(this._blinkInterval);
                this._blinkInterval = null;
                this._blinkState = true;
            }

            var scheme = SCHEMES[schemeName] || SCHEMES.green;
            var seals = data.seals || DEFAULT_SEALS;

            ctx.fillStyle = scheme.bg;
            ctx.fillRect(0, 0, w, h);

            var pad = Math.max(8, Math.min(w, h) * 0.03);
            var innerW = w - pad * 2;
            var innerH = h - pad * 2;

            drawBoxBorder(ctx, pad, pad, innerW, innerH, scheme.dim, 2);

            var fontSize = Math.max(9, Math.min(15, Math.min(w * 0.022, h * 0.038)));
            var titleFontSize = Math.max(10, fontSize * 1.2);
            var headerH = titleFontSize * 4;

            drawHLine(ctx, pad, pad + innerW, pad + headerH, scheme.dim);

            var tx = pad * 2.5;
            var ty = pad + titleFontSize * 1.3;
            drawGlowText(ctx, 'NAKATOMI PLAZA', tx, ty, scheme.primary, titleFontSize, 8);
            drawGlowText(ctx, 'VAULT PROTOCOL \u2014 ELECTROMAGNETIC SEALS',
                tx, ty + titleFontSize * 1.6, scheme.dim, fontSize * 0.85, 3);

            ctx.textAlign = 'right';
            var rx = pad + innerW - pad;
            drawGlowText(ctx, 'SYSTEM ARMED', rx, ty, scheme.red, fontSize * 0.8, 6);
            drawGlowText(ctx, 'POWER ONLINE', rx, ty + titleFontSize * 1.6,
                scheme.primary, fontSize * 0.8, 4);
            ctx.textAlign = 'left';

            var sealAreaTop = pad + headerH + pad * 0.5;
            var footerH = fontSize * 3;
            var sealAreaH = innerH - headerH - footerH - pad;
            var lineHeight = Math.min(sealAreaH / seals.length, fontSize * 3);
            var ledRadius = Math.max(3, fontSize * 0.45);

            for (var i = 0; i < seals.length; i++) {
                var seal = seals[i];
                var rowY = sealAreaTop + (i * lineHeight) + lineHeight * 0.5;

                if (seal.status === 'ACTIVE') {
                    ctx.fillStyle = 'rgba(212, 168, 67, 0.04)';
                    ctx.fillRect(pad + 1, rowY - lineHeight * 0.4,
                        innerW - 2, lineHeight * 0.85);
                }

                var ledX = tx + ledRadius;
                var ledColor, ledGlow;

                if (seal.status === 'OPEN') {
                    ledColor = scheme.primary;
                    ledGlow = scheme.primary;
                } else if (seal.status === 'ACTIVE') {
                    ledColor = this._blinkState ? scheme.amber : 'rgba(212,168,67,0.4)';
                    ledGlow = scheme.amber;
                } else if (seal.status === '???') {
                    ledColor = this._blinkState ? scheme.dark : scheme.border;
                    ledGlow = scheme.dark;
                } else {
                    ledColor = scheme.redDim;
                    ledGlow = 'rgba(255,50,50,0.2)';
                }

                drawLED(ctx, ledX, rowY, ledRadius, ledColor, ledGlow);

                var labelX = ledX + ledRadius * 4;
                var sealLabel = 'SEAL ' + seal.num;
                drawGlowText(ctx, sealLabel, labelX, rowY + fontSize * 0.35,
                    scheme.primary, fontSize, 4);

                var nameX = labelX + fontSize * 5;
                var nameColor = seal.status === 'ACTIVE' ? scheme.amber : scheme.dim;
                var displayName = seal.name;
                var maxNameW = (w * 0.5) - nameX;
                ctx.font = (fontSize * 0.9) + 'px monospace';
                if (ctx.measureText(displayName).width > maxNameW && maxNameW > 0) {
                    while (ctx.measureText(displayName + '..').width > maxNameW &&
                           displayName.length > 3) {
                        displayName = displayName.substring(0, displayName.length - 1);
                    }
                    displayName = displayName + '..';
                }
                drawGlowText(ctx, displayName, nameX, rowY + fontSize * 0.35,
                    nameColor, fontSize * 0.9, 2);

                var statusColor;
                if (seal.status === 'OPEN') statusColor = scheme.primary;
                else if (seal.status === 'ACTIVE') statusColor = scheme.amber;
                else if (seal.status === '???') statusColor = scheme.dim;
                else statusColor = scheme.red;

                ctx.textAlign = 'right';
                drawGlowText(ctx, seal.status, rx, rowY + fontSize * 0.35,
                    statusColor, fontSize, 5);
                ctx.textAlign = 'left';

                if (i < seals.length - 1) {
                    drawHLine(ctx, tx, pad + innerW - pad,
                        rowY + lineHeight * 0.45, scheme.border);
                }
            }

            var footerY = pad + innerH - footerH;
            drawHLine(ctx, pad, pad + innerW, footerY, scheme.dim);

            var fy = footerY + footerH * 0.55;
            drawGlowText(ctx, 'SEVEN SEALS. ONE VAULT. NO SECOND CHANCES.',
                tx, fy, scheme.dim, fontSize * 0.8, 2);

            if (this._blinkState) {
                ctx.textAlign = 'right';
                drawGlowText(ctx, '\u2588', rx, fy, scheme.primary, fontSize, 8);
                ctx.textAlign = 'left';
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
