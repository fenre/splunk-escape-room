import React from 'react';
import ReactDOM from 'react-dom';
import NakatomiTerminal from '../../components/NakatomiTerminal';
import '../../styles/crt.css';

var root = document.getElementById('root');
if (root) {
    ReactDOM.render(<NakatomiTerminal />, root);
}
