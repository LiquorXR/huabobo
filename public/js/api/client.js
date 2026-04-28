export const API = {
    getToken() {
        return localStorage.getItem('huabobo_token');
    },
    setToken(token) {
        localStorage.setItem('huabobo_token', token);
    },
    clearToken() {
        localStorage.removeItem('huabobo_token');
        localStorage.removeItem('huabobo_user');
    },
    setUser(user) {
        localStorage.setItem('huabobo_user', JSON.stringify(user));
    },
    getUser() {
        const user = localStorage.getItem('huabobo_user');
        return user ? JSON.parse(user) : null;
    },
    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    },
    async request(url, options = {}) {
        options.headers = Object.assign({}, this.getHeaders(), options.headers || {});
        const res = await fetch(url, options);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server error');
        return data;
    },

    // Auth
    async login(username, password) {
        const data = await this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        this.setToken(data.token);
        this.setUser(data.user);
        return data.user;
    },
    async register(username, password, email = '') {
        const data = await this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, email })
        });
        this.setToken(data.token);
        this.setUser(data.user);
        return data.user;
    },
    async checkRegisterAvailability(username, email = '') {
        return await this.request('/api/auth/check-register', {
            method: 'POST',
            body: JSON.stringify({ username, email })
        });
    },
    async updateUsername(newUsername) {
        const data = await this.request('/api/auth/username', {
            method: 'PUT',
            body: JSON.stringify({ newUsername })
        });
        if (data.token) this.setToken(data.token);
        if (data.user) this.setUser(data.user);
        return data.user;
    },
    async updateEmail(email) {
        const data = await this.request('/api/auth/email', {
            method: 'PUT',
            body: JSON.stringify({ email })
        });
        if (data.token) this.setToken(data.token);
        if (data.user) this.setUser(data.user);
        return data.user;
    },
    async updatePassword(currentPassword, newPassword) {
        const data = await this.request('/api/auth/password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        if (data.token) this.setToken(data.token);
        if (data.user) this.setUser(data.user);
        return data.user;
    },
    async updateAccountSettings(payload) {
        const data = await this.request('/api/auth/account', {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        if (data.token) this.setToken(data.token);
        if (data.user) this.setUser(data.user);
        return data.user;
    },
    
    // Projects
    async getMyProjects() {
        return await this.request('/api/projects');
    },
    async saveProject(payload) {
        return await this.request('/api/projects', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },
    async deleteProject(id) {
        return await this.request(`/api/projects/${id}`, { method: 'DELETE' });
    },

    // Community
    async getCommunityPosts(limit = 20, offset = 0) {
        return await this.request(`/api/community?limit=${limit}&offset=${offset}`);
    },
    async likePost(id) {
        return await this.request(`/api/community/${id}/like`, { method: 'POST' });
    }
};
