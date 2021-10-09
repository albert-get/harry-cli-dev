'use strict';

const axios = require('axios');

const constant = require('./const');

const request = axios.create({
    baseURL:constant.BASE_URL,
    timeout: 5000,
});

request.interceptors.response.use(
    response => {
        return response.data;
    },
    error => {
        return Promise.reject(error)
    }
)

module.exports = request;

