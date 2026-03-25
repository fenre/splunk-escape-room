import React from 'react';

export default function ResultsTable(props) {
    if (props.loading) {
        return (
            <div className="nk-results-status">
                <div className="nk-searching">
                    {'EXECUTING QUERY'}
                    <span className="nk-dots" />
                </div>
            </div>
        );
    }

    if (props.error) {
        return (
            <div className="nk-results-status nk-error">
                <div>{'> ERROR: '}{String(props.error)}</div>
            </div>
        );
    }

    if (!props.results) {
        return (
            <div className="nk-results-status nk-idle">
                <div>{'> AWAITING QUERY INPUT'}</div>
                <div className="nk-idle-hint">
                    {'Type an SPL query above and press ENTER'}
                </div>
            </div>
        );
    }

    if (props.results.length === 0) {
        return (
            <div className="nk-results-status nk-warning">
                <div>{'> NO RESULTS FOUND'}</div>
            </div>
        );
    }

    var fields = props.fields || [];
    var rows = props.results;

    return (
        <div className="nk-results-area">
            <div className="nk-results-count">
                {'> '}{rows.length}{' RECORDS RETURNED  \u2502  '}
                {fields.length}{' FIELDS'}
            </div>
            <div className="nk-results-scroll">
                <table className="nk-table">
                    <thead>
                        <tr>
                            {fields.map(function (f) {
                                return <th key={f}>{f}</th>;
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(function (row, ri) {
                            return (
                                <tr key={ri}>
                                    {fields.map(function (f) {
                                        return <td key={f}>{row[f] || ''}</td>;
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
