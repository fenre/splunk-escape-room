import React, { useRef, useEffect } from 'react';

export default function SearchPrompt(props) {
    var inputRef = useRef(null);

    useEffect(function () {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !props.loading) {
            props.onSubmit(props.query);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            var prev = props.onHistoryUp();
            if (prev !== undefined) props.setQuery(prev);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            var next = props.onHistoryDown();
            if (next !== undefined) props.setQuery(next);
        }
    }

    return (
        <div className="nk-prompt-row">
            <span className="nk-prompt-symbol">{'>'}</span>
            <input
                ref={inputRef}
                type="text"
                className="nk-prompt-input"
                value={props.query}
                onChange={function (e) { props.setQuery(e.target.value); }}
                onKeyDown={handleKeyDown}
                placeholder="ENTER SPL QUERY ..."
                spellCheck={false}
                autoComplete="off"
                disabled={props.loading}
            />
            {props.loading && <span className="nk-prompt-spinner">SEARCHING...</span>}
        </div>
    );
}
