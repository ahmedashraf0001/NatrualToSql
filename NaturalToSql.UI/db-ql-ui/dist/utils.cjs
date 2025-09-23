"use strict";
exports.isDev = () => {
    return process.env.NODE_ENV === 'development';
};
exports.isProduction = () => {
    return process.env.NODE_ENV === 'production';
};
exports.delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
