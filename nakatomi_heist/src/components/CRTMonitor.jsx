import React from 'react';

export default function CRTMonitor(props) {
    var contentClass = 'crt-content' + (props.bootMode ? ' nk-boot-mode' : '');
    return (
        <div className="crt-monitor">
            <div className="crt-brand">NAKATOMI CORP \u2022 NPC-8800</div>
            <div className="crt-bezel">
                <div className="crt-screen">
                    <div className={contentClass}>
                        {props.children}
                    </div>
                    <div className="crt-scanlines" />
                    <div className="crt-vignette" />
                    <div className="crt-flicker" />
                </div>
            </div>
            <div className="crt-base">
                <div className="crt-base-left">
                    <div className="crt-led" />
                    <span className="crt-model">NPC-8800</span>
                </div>
                {props.toggleIntel && (
                    <button
                        className={'nk-intel-btn' + (props.intelOpen ? ' nk-intel-open' : '')}
                        onClick={props.toggleIntel}
                    >
                        {props.intelOpen ? '\u2588 HIDE INTEL' : '\u2588 MISSION INTEL'}
                    </button>
                )}
            </div>
        </div>
    );
}
