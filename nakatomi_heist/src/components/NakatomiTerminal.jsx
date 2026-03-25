import React, { useState, useRef, useEffect, useCallback } from 'react';
import CRTMonitor from './CRTMonitor';
import Sidebar from './Sidebar';

var BOOT_LINES = [
    'NAKATOMI PLAZA SECURITY SYSTEM v2.1',
    'COPYRIGHT (C) 1988 NAKATOMI TRADING CORP.',
    '',
    'INITIALIZING SYSTEM ...',
    'LOADING SECURITY PROTOCOLS ... OK',
    'BADGE READER NETWORK ... ONLINE',
    'VAULT ACCESS PROTOCOL ... ARMED',
    'BUILDING MANAGEMENT ... MONITORING',
    '',
    'WARNING: UNAUTHORIZED ACCESS DETECTED',
    'WARNING: MULTIPLE SECURITY OVERRIDES IN PROGRESS',
    '',
    '> TERMINAL READY',
];

var INJECT_CSS = [
    'header, .enterprise-header, [data-view="views/shared/splunkbar/Master"],',
    '.splunk-header, [data-role="header"] { display: none !important; }',
    '.app-bar, nav.app-bar, [data-role="app-bar"] { display: none !important; }',
    'footer, .footer { display: none !important; }',
    'body {',
    '  background: #000800 !important;',
    '  margin: 0 !important;',
    '  overflow: auto !important;',
    '}',
    '.main-section-body {',
    '  padding: 0 8px !important;',
    '  margin: 0 !important;',
    '  background: transparent !important;',
    '}',
    '.search-bar-wrapper { margin-top: 4px !important; }',
    '.shared-searchbar { background: transparent !important; }',
    '.search-assistant-autoopen-toggle { display: none !important; }',
].join('\n');

export default function NakatomiTerminal() {
    var _b = useState(true), booting = _b[0], setBooting = _b[1];
    var _bl = useState([]), bootLines = _bl[0], setBootLines = _bl[1];
    var _loaded = useState(false), iframeLoaded = _loaded[0], setIframeLoaded = _loaded[1];
    var _intel = useState(false), intelOpen = _intel[0], setIntelOpen = _intel[1];
    var bootTimerRef = useRef(null);
    var iframeRef = useRef(null);

    var toggleIntel = useCallback(function () {
        setIntelOpen(function (prev) { return !prev; });
    }, []);

    useEffect(function () {
        var lineIdx = 0;
        function addLine() {
            if (lineIdx < BOOT_LINES.length) {
                setBootLines(function (prev) { return prev.concat([BOOT_LINES[lineIdx]]); });
                lineIdx++;
                bootTimerRef.current = setTimeout(addLine, 60 + Math.random() * 80);
            } else {
                bootTimerRef.current = setTimeout(function () { setBooting(false); }, 400);
            }
        }
        addLine();
        return function () { if (bootTimerRef.current) clearTimeout(bootTimerRef.current); };
    }, []);

    useEffect(function () {
        if (booting || !iframeRef.current) return;

        var iframe = iframeRef.current;
        function onLoad() {
            try {
                var doc = iframe.contentDocument || iframe.contentWindow.document;
                var style = doc.createElement('style');
                style.textContent = INJECT_CSS;
                doc.head.appendChild(style);
            } catch (e) {}
            setIframeLoaded(true);
        }
        iframe.addEventListener('load', onLoad);
        return function () { iframe.removeEventListener('load', onLoad); };
    }, [booting]);

    if (booting) {
        return (
            <div className="nk-page">
                <CRTMonitor bootMode>
                    <div className="nk-boot">
                        {bootLines.map(function (line, i) {
                            return <div key={i} className="nk-boot-line">{line}</div>;
                        })}
                        <span className="nk-cursor">_</span>
                    </div>
                </CRTMonitor>
            </div>
        );
    }

    return (
        <div className="nk-page">
            <CRTMonitor intelOpen={intelOpen} toggleIntel={toggleIntel}>
                <div className="nk-crt-inner">
                    <div className="nk-terminal-header-bar">
                        <span className="nk-header-text">
                            {'> NAKATOMI PLAZA \u2014 DATA QUERY TERMINAL v2.1'}
                        </span>
                        <span className="nk-header-status">
                            STATUS: <span className="nk-status-online">ONLINE</span>
                            {'  \u2502  '}
                            CLEARANCE: <span className="nk-status-override">OVERRIDE</span>
                        </span>
                    </div>
                    <div className="nk-iframe-container">
                        <iframe
                            ref={iframeRef}
                            src="/app/nakatomi_heist/search?earliest=0&latest=now"
                            className={'nk-search-iframe' + (iframeLoaded ? ' nk-iframe-visible' : '')}
                            title="Nakatomi Terminal"
                        />
                        {!iframeLoaded && (
                            <div className="nk-iframe-loading">
                                ESTABLISHING CONNECTION<span className="nk-dots" />
                            </div>
                        )}
                        {/* Intel drawer slides in from the right over the iframe */}
                        <div className={'nk-intel-drawer' + (intelOpen ? ' nk-intel-visible' : '')}>
                            <button className="nk-intel-close" onClick={toggleIntel} title="Close">
                                {'\u2715'}
                            </button>
                            <Sidebar />
                        </div>
                    </div>
                </div>
            </CRTMonitor>
        </div>
    );
}
