import { useState, useRef, useCallback } from 'react';

var STRIP_FIELDS = [
    '_bkt', '_cd', '_indextime', '_raw', '_serial', '_si',
    '_subsecond', '_sourcetype', 'host', 'index', 'linecount',
    'source', 'sourcetype', 'splunk_server',
];

function getCSRFToken() {
    var cookie = document.cookie;
    var match = cookie.match(/splunkweb_csrf_token_8000=([^;]+)/);
    if (match) return match[1];
    match = cookie.match(/splunkweb_csrf_token_\d+=([^;]+)/);
    if (match) return match[1];
    var meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) return meta.getAttribute('content');
    return null;
}

function getAppName() {
    var path = window.location.pathname;
    var match = path.match(/\/app\/([^/]+)/);
    return match ? match[1] : 'nakatomi_heist';
}

function buildResultObjects(fields, rows) {
    var visible = fields.filter(function (f) { return STRIP_FIELDS.indexOf(f) === -1; });
    return {
        fields: visible,
        rows: rows.map(function (row) {
            var obj = {};
            visible.forEach(function (f) {
                var val = row[f];
                if (val !== null && val !== undefined && val !== '') {
                    obj[f] = val;
                }
            });
            return obj;
        }),
    };
}

function splunkFetch(url, options) {
    var csrf = getCSRFToken();
    var headers = Object.assign({
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded',
    }, options.headers || {});
    if (csrf) headers['X-Splunk-Form-Key'] = csrf;

    return fetch(url, Object.assign({}, options, {
        credentials: 'include',
        headers: headers,
    }));
}

export default function useSearch() {
    var _s = useState(null), results = _s[0], setResults = _s[1];
    var _e = useState(null), error = _e[0], setError = _e[1];
    var _l = useState(false), loading = _l[0], setLoading = _l[1];
    var _f = useState([]), fields = _f[0], setFields = _f[1];
    var cancelRef = useRef(false);

    var runSearch = useCallback(function (spl) {
        if (!spl || !spl.trim()) return;

        var trimmed = spl.trim();
        if (trimmed.charAt(0) !== '|') {
            spl = 'search ' + trimmed;
        }

        cancelRef.current = false;
        setLoading(true);
        setError(null);
        setResults(null);
        setFields([]);

        var app = getAppName();
        var prefix = window.location.pathname.match(/^\/[^/]+/)
            ? window.location.pathname.match(/^\/[^/]+/)[0]
            : '';
        var baseUrl = prefix + '/splunkd/__raw/servicesNS/nobody/' + app;

        splunkFetch(baseUrl + '/search/jobs', {
            method: 'POST',
            body: 'search=' + encodeURIComponent(spl) +
                  '&earliest_time=0&latest_time=now&output_mode=json',
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (cancelRef.current) return;
            var sid = data.sid;
            if (!sid) throw new Error(data.messages ? data.messages[0].text : 'Failed to create search job');
            return pollForResults(baseUrl, sid);
        })
        .catch(function (err) {
            if (!cancelRef.current) {
                setError(err.message || String(err));
                setLoading(false);
            }
        });

        function pollForResults(baseUrl, sid) {
            if (cancelRef.current) return;

            return splunkFetch(baseUrl + '/search/jobs/' + sid + '?output_mode=json', { method: 'GET' })
                .then(function (r) { return r.json(); })
                .then(function (status) {
                    if (cancelRef.current) return;
                    var entry = status.entry && status.entry[0];
                    var content = entry && entry.content;
                    if (!content) throw new Error('Invalid search status response');

                    if (content.isDone) {
                        return splunkFetch(
                            baseUrl + '/search/jobs/' + sid + '/results?output_mode=json&count=500',
                            { method: 'GET' }
                        )
                        .then(function (r) { return r.json(); })
                        .then(function (resData) {
                            if (cancelRef.current) return;
                            var rawFields = (resData.fields || []).map(function (f) { return f.name || f; });
                            var rawRows = resData.results || [];
                            var processed = buildResultObjects(rawFields, rawRows);
                            setFields(processed.fields);
                            setResults(processed.rows);
                            setLoading(false);
                        });
                    } else if (content.isFailed) {
                        throw new Error('Search failed: ' + (content.messages && content.messages[0] ? content.messages[0].text : 'Unknown error'));
                    } else {
                        return new Promise(function (resolve) {
                            setTimeout(function () { resolve(pollForResults(baseUrl, sid)); }, 500);
                        });
                    }
                });
        }
    }, []);

    var cancel = useCallback(function () {
        cancelRef.current = true;
        setLoading(false);
    }, []);

    return { results: results, fields: fields, error: error, loading: loading, runSearch: runSearch, cancel: cancel };
}
