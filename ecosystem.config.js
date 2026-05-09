module.exports = {
    apps: [{
        name: 'huabobo',
        script: 'server.js',
        instances: 1,
        exec_mode: 'cluster',
        max_memory_restart: '300M',
        env: {
            NODE_ENV: 'production'
        }
    }]
};
