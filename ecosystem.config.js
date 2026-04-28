module.exports = {
    apps: [{
        name: 'huabobo',
        script: 'server.js',
        instances: 'max',
        exec_mode: 'cluster',
        max_memory_restart: '512M',
        env: {
            NODE_ENV: 'production'
        }
    }]
};
