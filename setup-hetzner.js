const { Client } = require('ssh2');

const conn = new Client();
const newPassword = 'PedsAppHetzner2026!'; // New root password

conn.on('ready', () => {
    console.log('Client :: ready');
    conn.shell((err, stream) => {
        if (err) throw err;
        let stage = 0;
        stream.on('close', () => {
            console.log('Stream :: close');
            conn.end();
        }).on('data', (data) => {
            const output = data.toString();
            process.stdout.write(output);

            if (output.includes('(current) UNIX password:') || output.includes('Current password:')) {
                stream.write('hbcrMcCLUgNsfPX4bCfa\n');
            } else if (output.includes('New password:')) {
                stream.write(newPassword + '\n');
            } else if (output.includes('Retype new password:')) {
                stream.write(newPassword + '\n');
            } else if (output.includes('root@') && output.includes('~') && stage === 0) {
                stage = 1;
                console.log('--- Logged in, executing setup commands ---');
                stream.write('mkdir -p ~/.ssh && echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK7FtXNdHv0saU1Oni0IEe+jNY9InNTjPGlXuItCZTNf cursor@berinia" > ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys\n');
                stream.write('sed -i "s/^#PasswordAuthentication yes/PasswordAuthentication no/" /etc/ssh/sshd_config\n');
                stream.write('sed -i "s/^PasswordAuthentication yes/PasswordAuthentication no/" /etc/ssh/sshd_config\n');
                stream.write('systemctl restart sshd\n');
                stream.write('apt-get update -y && apt-get install -y ufw fail2ban curl git\n');
                stream.write('ufw default deny incoming && ufw default allow outgoing && ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable\n');
                stream.write('systemctl enable fail2ban && systemctl start fail2ban\n');
                stream.write('curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh\n');
                stream.write('echo "SETUP_COMPLETE"\n');
            } else if (output.includes('SETUP_COMPLETE')) {
                stream.write('exit\n');
            }
        });
    });
}).connect({
    host: '89.167.94.105',
    port: 22,
    username: 'root',
    password: 'hbcrMcCLUgNsfPX4bCfa',
    readyTimeout: 60000
});
