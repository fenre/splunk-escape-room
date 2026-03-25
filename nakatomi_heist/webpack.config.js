const path = require('path');

module.exports = {
    mode: 'production',
    entry: {
        terminal: path.resolve(__dirname, 'src/pages/terminal/index.jsx'),
    },
    output: {
        path: path.resolve(__dirname, 'appserver/static/pages'),
        filename: '[name].js',
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', { targets: { chrome: '80' } }],
                            '@babel/preset-react',
                        ],
                    },
                },
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    resolve: {
        extensions: ['.jsx', '.js'],
    },
    externals: {},
};
