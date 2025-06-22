import axios from 'axios';

class BaseService {
    constructor(options) {
        this.isFromServer = typeof window === 'undefined';
        this.axios = axios.create(options);
    }

    setInterceptors({
        beforeRequest,
        requestError,
        afterResponse,
        responseError,
    }) {
        this.axios.interceptors.request.use(beforeRequest, requestError);
        this.axios.interceptors.response.use(afterResponse, responseError);
    }

    setHeader(key, value) {
        this.axios.defaults.headers.common[key] = value;
    }

    setBaseURL(baseURL) {
        this.axios.defaults.baseURL = baseURL;
    }

    setPrefix(prefix) {
        this.axios.defaults.baseURL = `${this.options.baseURL}${prefix}`;
    }
}

export default BaseService;
