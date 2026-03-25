import React from 'react';

var SEALS = [
    { num: 1, name: 'THE LOBBY', hint: 'index=nakatomi_access floor=1' },
    { num: 2, name: 'SECURING', hint: 'index=nakatomi_access floor>25 | stats count by floor' },
    { num: 3, name: 'TAKAGI', hint: 'index=nakatomi_vault | transaction session_id' },
    { num: 4, name: 'THE ROOF', hint: 'index=nakatomi_building floor=roof system=hvac' },
    { num: 5, name: 'THE FBI', hint: 'index=nakatomi_building channel=freq_14' },
    { num: 6, name: 'BONDS', hint: '| inputlookup employee_directory.csv | search badge_id="NP-4472"' },
    { num: 7, name: '???', hint: '...' },
];

export default function Sidebar() {
    return (
        <div>
            <div className="nk-sidebar-section">
                <div className="nk-sidebar-title">{'\u2588 MISSION OBJECTIVES'}</div>
                <div className="nk-sidebar-body">
                    {SEALS.map(function (s) {
                        return (
                            <div key={s.num} className="nk-seal-row">
                                <span className="nk-seal-num">SEAL {s.num}</span>
                                <span className="nk-seal-name">{s.name}</span>
                                <div className="nk-seal-hint">{s.hint}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="nk-sidebar-section">
                <div className="nk-sidebar-title">{'\u2588 DATA SOURCES'}</div>
                <div className="nk-sidebar-body nk-ds-list">
                    <div><span className="nk-ds-label">nakatomi_access</span> Badge readers, doors</div>
                    <div><span className="nk-ds-label">nakatomi_vault</span> Vault terminal sessions</div>
                    <div><span className="nk-ds-label">nakatomi_building</span> HVAC, elevator, radio</div>
                </div>
            </div>
            <div className="nk-sidebar-section">
                <div className="nk-sidebar-title">{'\u2588 LOOKUPS'}</div>
                <div className="nk-sidebar-body nk-ds-list">
                    <div className="nk-lookup-cmd">| inputlookup employee_directory.csv</div>
                    <div className="nk-lookup-cmd">| inputlookup floor_directory.csv</div>
                    <div className="nk-lookup-cmd">| inputlookup system_codes.csv</div>
                </div>
            </div>
        </div>
    );
}
