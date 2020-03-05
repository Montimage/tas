const path = require("path");
const webpack = require("webpack");
const dotenv = require('dotenv');
require("babel-polyfill");

// read and pass the environment variables into reactjs application
const env = dotenv.config().parsed;
// reduce it to a nice object, the same as before
const envKeys = Object.keys(env).reduce((prev, next) => {
  prev[`process.env.${next}`] = JSON.stringify(env[next]);
  return prev;
}, {});

module.exports = {
  entry: ['babel-regenerator-runtime',__dirname + "/client/index.js"],
  mode: "development",
  module: {
    rules: [{
        test: /\.(js|jsx)$/,
        exclude: /(node_modules|bower_components)/,
        loader: "babel-loader",
        options: {
          presets: ["@babel/env"]
        }
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      },
      {test: /\.svg$/, loader: 'file-loader'}
    ]
  },
  resolve: {
    extensions: ["*", ".js", ".jsx"]
  },
  output: {
    path: path.resolve(__dirname, "dist/"),
    publicPath: "/dist/",
    filename: "bundle.js"
  },
  devServer: {
    contentBase: path.join(__dirname, "public/"),
    port: env.DASHBOARD_PORT,
    host: `${env.DASHBOARD_HOST}`,
    publicPath: `http://${env.DASHBOARD_HOST}:${env.DASHBOARD_PORT}/dist/`,
    hotOnly: true
  },
  plugins: [new webpack.HotModuleReplacementPlugin(), new webpack.DefinePlugin(envKeys)]
};