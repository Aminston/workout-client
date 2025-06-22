'use strict';

import Base from '@/services/base.service';
import auth from './auth.service';

class AdminService extends Base {
    constructor() {
        super({
            baseURL: '',
        });
        this.context = null;
        // API modules
        this.auth = auth;

        // Interceptors
        const token = localStorage.getItem('jwt_token');
        if (token) {
            this.setAuth(token);
        }
        this.setInterceptors({
            afterResponse: r => r.data,
            responseError: e => {
                const status = e?.response?.status || 500;

                if (['/update-password'].includes(e.response.config.url)) {
                    return Promise.reject(e);
                }

                if (status === 401) {
                    this.#logout();
                }
                return Promise.reject(e);
            },
        });
    }

    #logout() {
        window.location.href = '_/logout';
    }

    #callMethod(method, ...args) {
        for (const key of Object.keys(this)) {
            try {
                this[key][method](...args);
            } catch {
                continue;
            }
        }
    }

    async setAuth(token) {
        if (typeof token === 'string') {
            this.#callMethod('setHeader', 'Authorization', `Bearer ${token}`);
        }
    }

    setInterceptors(interceptors) {
        this.#callMethod('setInterceptors', interceptors);
    }
}

export default new AdminService();
