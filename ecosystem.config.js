module.exports = {
    apps: [
        {
            name: 'evident-backend',
            cwd: './backend',
            script: 'bun',
            args: 'dev',
            env: {
                NODE_ENV: 'preview',
            },
        },
        {
            name: 'evident-audio-worker',
            cwd: './audio-worker',
            script: 'bun',
            args: 'index.ts',
            env: {
                NODE_ENV: 'preview',
            },
        },
        // {
        //     name: 'evident-client',
        //     cwd: './client',
        //     script: 'pnpm',
        //     args: 'dev',
        //     env: {
        //         NODE_ENV: 'development',
        //     },
        // },
    ],
};
