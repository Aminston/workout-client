import Base from '@/services/base.service';

class AuthService extends Base {
    constructor() {
        super({ baseURL: import.meta.env.VITE_API_URL });
    }

    login(data) {
        return this.axios
            .post(
                '/auth/login',
                {},
                {
                    headers: {
                        authorization: `Basic ${btoa(`${data.email}:${data.password}`)}`,
                    },
                }
            )
            .then(r => {
                if (r.error) throw new Error(r.error);
                return r;
            });
    }

    getUserData(userId) {
        return this.axios.get(`/users/${userId}`).then(r => {
            if (r.error) throw new Error(r.error);
            return r;
        });
    }
}

export default new AuthService();
