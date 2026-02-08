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
        //     name: 'evident-transcript-worker',
        //     cwd: './transcript-worker',
        //     script: 'bun',
        //     args: 'start',
        //     env: {
        //         NODE_ENV: 'preview',
        //     },
        // },
        {
            name: 'evident-client',
            cwd: './client',
            script: 'npm',
            args: 'run start',
            env: {
                NODE_ENV: 'production',
                PORT: 3001,
            },
        },
    ],
};
